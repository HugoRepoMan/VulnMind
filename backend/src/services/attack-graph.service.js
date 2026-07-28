const normalize = (value) => String(value ?? '').trim().toLowerCase();
const compact = (value, limit = 240) => {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};
const unique = (values) => [...new Set(values.filter(Boolean))];

const publicIpv4 = (value) => {
  const parts = String(value ?? '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return !(
    first === 10 || first === 127 || first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
};

export const isExternallyReachable = (asset, rawData) => {
  const exposure = normalize(rawData.exposure || rawData.scope || rawData.networkScope);
  return rawData.public === true || rawData.internetFacing === true || rawData.internetExposed === true ||
    ['internet', 'external', 'public', 'externo', 'publico', 'público'].includes(exposure) ||
    publicIpv4(asset.ip);
};

const arrayValues = (rawData, fields) => fields.flatMap((field) => {
  const value = rawData[field];
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}).map((value) => compact(value, 120)).filter(Boolean);

const priority = (score) => score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
const tagsOf = (finding) => new Set(
  (Array.isArray(finding.rawData?.tags) ? finding.rawData.tags : [])
    .map((tag) => normalize(tag))
);
const hasAnyTag = (finding, expected) => {
  const tags = tagsOf(finding);
  return expected.some((tag) => tags.has(tag));
};
const nodeIdForAsset = (assetId) => `asset:${assetId}`;
const nodeIdForService = (finding) => {
  const rawData = finding.rawData || {};
  const protocol = normalize(rawData.protocol) || 'unknown';
  const port = finding.port ?? rawData.port ?? 'none';
  return `service:${finding.assetId || finding.asset.id}:${protocol}:${port}`;
};
const nodeIdForVulnerability = (finding, vulnerability) =>
  `vulnerability:${finding.id}:${normalize(vulnerability)}`;

/**
 * Pure transformation from persisted Prisma records to a semantic graph.
 * It never creates an edge without a finding, explicit target, persisted
 * correlation, or compatible persisted tags that explain the relationship.
 */
export const transformPersistedAttackGraph = ({ findings, assets, auditId }) => {
  const auditAssets = assets.filter((asset) => !auditId || asset.auditId === auditId);
  const assetIds = new Set(auditAssets.map(({ id }) => id));
  const auditFindings = findings.filter((finding) =>
    assetIds.has(finding.assetId || finding.asset?.id) &&
    (!auditId || finding.asset?.auditId === undefined || finding.asset.auditId === auditId)
  );
  const nodes = new Map();
  const edges = new Map();
  const findingPaths = new Map();
  const findingTerminals = new Map();
  const findingVulnerabilities = new Map();
  const findingIdentities = new Map();
  const assetByIdentity = new Map();

  const addNode = (node) => {
    const current = nodes.get(node.id);
    if (!current) {
      nodes.set(node.id, {
        ...node,
        findingIds: unique(node.findingIds || []),
        ruleNames: unique(node.ruleNames || [])
      });
      return node.id;
    }
    nodes.set(node.id, {
      ...current,
      riskScore: Math.max(current.riskScore || 0, node.riskScore || 0),
      findingIds: unique([...(current.findingIds || []), ...(node.findingIds || [])]),
      ruleNames: unique([...(current.ruleNames || []), ...(node.ruleNames || [])]),
      serviceCount: Math.max(current.serviceCount || 0, node.serviceCount || 0),
      findingCount: Math.max(current.findingCount || 0, node.findingCount || 0)
    });
    return node.id;
  };
  const addEdge = ({ source, target, type, reason, findingIds = [], correlation = false }) => {
    if (!nodes.has(source) || !nodes.has(target) || source === target) return null;
    const id = `edge:${source}:${target}:${type}`;
    const current = edges.get(id);
    if (current) {
      current.findingIds = unique([...current.findingIds, ...findingIds]);
      return id;
    }
    edges.set(id, {
      id,
      source,
      target,
      type,
      reason,
      findingIds: unique(findingIds),
      correlation
    });
    return id;
  };

  const servicesByAsset = new Map();
  const findingsByAsset = new Map();
  auditFindings.forEach((finding) => {
    const assetId = finding.assetId || finding.asset.id;
    const rawData = finding.rawData || {};
    if (finding.port ?? rawData.port ?? rawData.service) {
      const set = servicesByAsset.get(assetId) || new Set();
      set.add(nodeIdForService(finding));
      servicesByAsset.set(assetId, set);
    }
    const list = findingsByAsset.get(assetId) || [];
    list.push(finding);
    findingsByAsset.set(assetId, list);
  });

  auditAssets.forEach((asset) => {
    const findingList = findingsByAsset.get(asset.id) || [];
    if (!findingList.length) return;
    const id = addNode({
      id: nodeIdForAsset(asset.id),
      type: 'ASSET',
      label: asset.name,
      subtitle: asset.ip || asset.type,
      assetId: asset.id,
      assetName: asset.name,
      auditId: asset.auditId,
      riskScore: asset.riskScore,
      criticality: asset.criticality,
      serviceCount: servicesByAsset.get(asset.id)?.size || 0,
      findingCount: findingList.length
    });
    [asset.name, asset.ip].filter(Boolean).forEach((identity) => {
      assetByIdentity.set(normalize(identity), id);
    });
  });

  auditFindings.forEach((finding) => {
    const rawData = finding.rawData || {};
    const analysis = finding.analysis || {};
    const asset = finding.asset;
    const assetId = nodeIdForAsset(asset.id);
    if (!nodes.has(assetId)) return;
    const protocol = normalize(rawData.protocol) || 'unknown';
    const port = finding.port ?? rawData.port ?? null;
    const service = analysis.inferredService || rawData.service || null;
    const version = analysis.inferredVersion || rawData.version || null;
    const vulnerability = finding.vulnerability || rawData.vulnerability || null;
    const rules = Array.isArray(analysis.rules)
      ? analysis.rules.map(({ name }) => name)
      : Array.isArray(analysis.matchedRules)
        ? analysis.matchedRules.map(({ name }) => name)
        : [];
    const path = { nodeIds: [], edgeIds: [] };

    let originId = null;
    if (isExternallyReachable(asset, rawData)) {
      originId = addNode({
        id: 'origin:internet',
        type: 'ENTRY',
        label: 'Internet',
        subtitle: 'Exposición externa persistida',
        riskScore: finding.riskScore,
        findingIds: [finding.id]
      });
    } else if (rawData.entryPoint) {
      const source = rawData.entryPoint;
      originId = addNode({
        id: `origin:source:${normalize(source)}`,
        type: 'ENTRY',
        label: source,
        subtitle: 'Punto de entrada persistido',
        riskScore: finding.riskScore,
        findingIds: [finding.id]
      });
    }
    if (originId) {
      path.nodeIds.push(originId);
      const edgeId = addEdge({
        source: originId,
        target: assetId,
        type: 'ORIGIN_ASSET',
        reason: isExternallyReachable(asset, rawData)
          ? 'El hallazgo persiste una exposición externa para este activo.'
          : `El hallazgo registra ${rawData.entryPoint} como punto de entrada.`,
        findingIds: [finding.id]
      });
      if (edgeId) path.edgeIds.push(edgeId);
    }
    path.nodeIds.push(assetId);

    let terminal = assetId;
    if (port) {
      const serviceId = addNode({
        id: nodeIdForService(finding),
        type: 'SERVICE',
        label: service || `Puerto ${port}`,
        subtitle: [protocol !== 'unknown' ? protocol.toUpperCase() : null, port ? `Puerto ${port}` : null, version].filter(Boolean).join(' · '),
        assetId: asset.id,
        assetName: asset.name,
        protocol,
        port,
        service,
        version,
        riskScore: finding.riskScore,
        findingIds: [finding.id],
        ruleNames: rules,
        evidence: rawData.evidence || null
      });
      const edgeId = addEdge({
        source: assetId,
        target: serviceId,
        type: 'ASSET_SERVICE',
        reason: `El hallazgo ${rawData.externalId || finding.id} pertenece al activo y registra ${service || 'un servicio'}${port ? ` en ${protocol}/${port}` : ''}.`,
        findingIds: [finding.id]
      });
      terminal = serviceId;
      path.nodeIds.push(serviceId);
      if (edgeId) path.edgeIds.push(edgeId);
    }

    if (vulnerability) {
      const vulnerabilityId = addNode({
        id: nodeIdForVulnerability(finding, vulnerability),
        type: 'VULNERABILITY',
        label: vulnerability,
        subtitle: rawData.title || `${finding.severity} · ${Math.round(finding.riskScore)}/100`,
        assetId: asset.id,
        assetName: asset.name,
        service,
        protocol,
        port,
        vulnerability,
        riskScore: finding.riskScore,
        severity: finding.severity,
        findingId: finding.id,
        externalId: rawData.externalId || null,
        findingIds: [finding.id],
        ruleNames: rules,
        evidence: rawData.evidence || null
      });
      const edgeId = addEdge({
        source: terminal,
        target: vulnerabilityId,
        type: terminal === assetId ? 'ASSET_VULNERABILITY' : 'SERVICE_VULNERABILITY',
        reason: `El hallazgo ${rawData.externalId || finding.id} identifica ${vulnerability} específicamente en ${service || (port ? `${protocol}/${port}` : asset.name)}.`,
        findingIds: [finding.id]
      });
      terminal = vulnerabilityId;
      findingVulnerabilities.set(finding.id, vulnerabilityId);
      path.nodeIds.push(vulnerabilityId);
      if (edgeId) path.edgeIds.push(edgeId);
    }

    const explicitIdentities = arrayValues(rawData, [
      'username', 'user', 'account', 'credential', 'credentials', 'privilege', 'role'
    ]);
    const taggedIdentity = hasAnyTag(finding, ['credential-reuse', 'excessive-privileges', 'privilege-escalation'])
      ? rawData.title || rawData.description
      : null;
    const identities = unique([...explicitIdentities, taggedIdentity]);
    identities.forEach((identity, index) => {
      const identityId = addNode({
        id: `identity:${finding.id}:${normalize(identity) || index}`,
        type: 'IDENTITY',
        label: identity,
        subtitle: hasAnyTag(finding, ['credential-reuse']) ? 'Credencial relacionada' : 'Usuario o privilegio',
        assetId: asset.id,
        assetName: asset.name,
        service,
        protocol,
        port,
        riskScore: finding.riskScore,
        severity: finding.severity,
        findingId: finding.id,
        externalId: rawData.externalId || null,
        findingIds: [finding.id],
        ruleNames: rules,
        evidence: rawData.evidence || null
      });
      const edgeId = addEdge({
        source: terminal,
        target: identityId,
        type: 'VULNERABILITY_IDENTITY',
        reason: `El hallazgo ${rawData.externalId || finding.id} registra explícitamente la cuenta, credencial o condición de privilegio “${identity}”.`,
        findingIds: [finding.id]
      });
      terminal = identityId;
      findingIdentities.set(finding.id, identityId);
      path.nodeIds.push(identityId);
      if (edgeId) path.edgeIds.push(edgeId);
    });

    if (rawData.evidence) {
      const evidenceId = addNode({
        id: `evidence:${finding.id}`,
        type: 'EVIDENCE',
        label: compact(rawData.evidence, 90),
        subtitle: rawData.externalId ? `Hallazgo ${rawData.externalId}` : 'Evidencia persistida',
        assetId: asset.id,
        assetName: asset.name,
        service,
        protocol,
        port,
        riskScore: finding.riskScore,
        severity: finding.severity,
        findingId: finding.id,
        externalId: rawData.externalId || null,
        findingIds: [finding.id],
        ruleNames: rules,
        evidence: rawData.evidence
      });
      const edgeId = addEdge({
        source: terminal,
        target: evidenceId,
        type: 'ENTITY_EVIDENCE',
        reason: `La evidencia persistida pertenece al hallazgo ${rawData.externalId || finding.id} y respalda únicamente su cadena.`,
        findingIds: [finding.id]
      });
      path.nodeIds.push(evidenceId);
      if (edgeId) path.edgeIds.push(edgeId);
    }

    findingTerminals.set(finding.id, terminal);
    findingPaths.set(finding.id, path);
  });

  // Persisted engine correlations only connect the exact findings referenced.
  auditFindings.forEach((finding) => {
    const correlation = finding.analysis?.correlation;
    (correlation?.correlatedEvents || []).forEach((event) => {
      const source = findingTerminals.get(event.findingId);
      const target = findingVulnerabilities.get(finding.id) || findingTerminals.get(finding.id);
      if (!source || !target) return;
      addEdge({
        source,
        target,
        type: 'PERSISTED_CORRELATION',
        reason: correlation.summary || 'El motor persistió una correlación entre estos hallazgos.',
        findingIds: [event.findingId, finding.id],
        correlation: true
      });
    });
  });

  // Explicit compatible tags on the same asset justify progression from an
  // initial-access vulnerability to a credential-reuse finding.
  auditFindings.filter((finding) => hasAnyTag(finding, ['credential-reuse'])).forEach((credentialFinding) => {
    const identityId = findingIdentities.get(credentialFinding.id);
    if (!identityId) return;
    auditFindings.filter((finding) =>
      (finding.assetId || finding.asset.id) === (credentialFinding.assetId || credentialFinding.asset.id) &&
      hasAnyTag(finding, ['initial-access', 'remote-code-execution'])
    ).forEach((entryFinding) => {
      const vulnerabilityId = findingVulnerabilities.get(entryFinding.id);
      if (!vulnerabilityId) return;
      addEdge({
        source: vulnerabilityId,
        target: identityId,
        type: 'TAG_CORRELATION',
        reason: `Los hallazgos ${entryFinding.rawData?.externalId || entryFinding.id} y ${credentialFinding.rawData?.externalId || credentialFinding.id} comparten el activo y etiquetas persistidas de acceso inicial/movimiento lateral.`,
        findingIds: [entryFinding.id, credentialFinding.id],
        correlation: true
      });
    });

    const relatedAsset = credentialFinding.rawData?.targetAsset || credentialFinding.rawData?.relatedAsset;
    const targetAssetId = assetByIdentity.get(normalize(relatedAsset));
    if (targetAssetId && hasAnyTag(credentialFinding, ['lateral-movement', 'credential-reuse'])) {
      addEdge({
        source: identityId,
        target: targetAssetId,
        type: 'EXPLICIT_LATERAL_TARGET',
        reason: `El hallazgo ${credentialFinding.rawData?.externalId || credentialFinding.id} declara el activo relacionado “${relatedAsset}” y etiquetas de movimiento lateral.`,
        findingIds: [credentialFinding.id],
        correlation: true
      });
    }
  });

  const graphNodes = [...nodes.values()];
  const graphEdges = [...edges.values()];
  const incoming = new Map(graphNodes.map(({ id }) => [id, []]));
  const outgoing = new Map(graphNodes.map(({ id }) => [id, []]));
  graphEdges.forEach((edge) => {
    incoming.get(edge.target)?.push(edge.id);
    outgoing.get(edge.source)?.push(edge.id);
  });
  const enrichedNodes = graphNodes.map((node) => ({
    ...node,
    incomingEdgeIds: incoming.get(node.id) || [],
    outgoingEdgeIds: outgoing.get(node.id) || []
  }));

  const baseRoutes = [...findingPaths.entries()].map(([findingId, path]) => {
    const finding = auditFindings.find(({ id }) => id === findingId);
    return {
      id: `route:${findingId}`,
      findingId,
      externalId: finding.rawData?.externalId || null,
      name: finding.rawData?.title || finding.vulnerability || finding.rawData?.service || `Hallazgo ${findingId}`,
      nodeIds: unique(path.nodeIds),
      edgeIds: unique(path.edgeIds),
      riskScore: finding.riskScore,
      priority: priority(finding.riskScore),
      explanation: finding.analysis?.correlation?.summary ||
        `Cadena demostrable del hallazgo ${finding.rawData?.externalId || finding.id} en ${finding.asset.name}.`
    };
  }).filter(({ edgeIds }) => edgeIds.length);

  const edgesBySource = new Map();
  graphEdges.forEach((edge) => {
    const list = edgesBySource.get(edge.source) || [];
    list.push(edge);
    edgesBySource.set(edge.source, list);
  });
  const nodeById = new Map(enrichedNodes.map((node) => [node.id, node]));
  const detectedRoutes = [];
  const walk = (nodeId, nodeIds, edgeIds, visited) => {
    if (nodeIds.length >= 14 || detectedRoutes.length >= 40) return;
    const nextEdges = (edgesBySource.get(nodeId) || [])
      .filter(({ target }) => !visited.has(target));
    if (!nextEdges.length) {
      if (edgeIds.length >= 2) {
        const routeRisk = Math.max(...nodeIds.map((id) => nodeById.get(id)?.riskScore || 0));
        detectedRoutes.push({
          id: `route:path:${edgeIds.join('|')}`,
          findingId: null,
          externalId: null,
          name: `Ruta ${nodeById.get(nodeIds[0])?.label} → ${nodeById.get(nodeIds.at(-1))?.label}`,
          nodeIds,
          edgeIds,
          riskScore: routeRisk,
          priority: priority(routeRisk),
          explanation: `Cadena compuesta únicamente por ${edgeIds.length} relaciones persistidas o demostrables.`
        });
      }
      return;
    }
    nextEdges.forEach((edge) => {
      walk(
        edge.target,
        [...nodeIds, edge.target],
        [...edgeIds, edge.id],
        new Set([...visited, edge.target])
      );
    });
  };
  enrichedNodes.filter(({ type }) => type === 'ENTRY').forEach((entry) => {
    walk(entry.id, [entry.id], [], new Set([entry.id]));
  });

  const detectedSignatures = new Set(detectedRoutes.map(({ edgeIds }) => edgeIds.join('|')));
  const routes = [
    ...detectedRoutes,
    ...baseRoutes.filter(({ edgeIds }) => !detectedSignatures.has(edgeIds.join('|')))
  ].sort((left, right) => {
      const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return weight[right.priority] - weight[left.priority] ||
        right.riskScore - left.riskScore ||
        right.edgeIds.length - left.edgeIds.length;
    });

  return {
    nodes: enrichedNodes,
    edges: graphEdges,
    routes,
    summary: {
      nodes: enrichedNodes.length,
      connections: graphEdges.length,
      routes: routes.length,
      highPriorityRoutes: routes.filter(({ priority: value }) => value === 'HIGH').length,
      analyzedFindings: auditFindings.length,
      assets: enrichedNodes.filter(({ type }) => type === 'ASSET').length
    }
  };
};

export const buildAttackGraph = transformPersistedAttackGraph;
