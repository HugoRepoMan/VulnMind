const resolvedStatuses = new Set(['RESOLVED', 'FALSE_POSITIVE']);

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const detail = (finding) => ({
  id: finding.id,
  port: finding.port ?? finding.rawData?.port ?? null,
  vulnerability: finding.vulnerability ?? finding.rawData?.vulnerability ?? null,
  service: finding.analysis?.inferredService ?? finding.rawData?.service ?? null,
  version: finding.analysis?.inferredVersion ?? finding.rawData?.version ?? null,
  status: finding.status,
  severity: finding.severity,
  riskScore: finding.riskScore
});

const findingKey = (finding) => {
  const item = detail(finding);
  const vulnerability = normalize(item.vulnerability);
  const service = normalize(item.service);
  return [
    item.port ? `port:${item.port}` : 'port:none',
    vulnerability ? `vulnerability:${vulnerability}` : `service:${service || 'unknown'}`
  ].join('|');
};

const portMap = (findings) => {
  const ports = new Map();
  findings.map(detail).forEach((finding) => {
    if (!finding.port) return;
    const current = ports.get(finding.port);
    if (!current || finding.riskScore > current.riskScore) ports.set(finding.port, finding);
  });
  return ports;
};

const findingMap = (findings) => {
  const mapped = new Map();
  findings.forEach((finding) => {
    const key = findingKey(finding);
    const current = mapped.get(key);
    if (!current || finding.riskScore > current.riskScore) mapped.set(key, detail(finding));
  });
  return mapped;
};

const sorted = (values) => [...values].sort((left, right) =>
  (right.riskScore ?? 0) - (left.riskScore ?? 0) || (left.port ?? 0) - (right.port ?? 0)
);

export const compareAssetScans = (baselineAsset, currentAsset) => {
  const baselineFindings = findingMap(baselineAsset.findings);
  const currentFindings = findingMap(currentAsset.findings);
  const baselinePorts = portMap(baselineAsset.findings);
  const currentPorts = portMap(currentAsset.findings);

  const newFindings = [];
  const persistentFindings = [];
  const reopenedFindings = [];
  const correctedFindings = [];

  currentFindings.forEach((current, key) => {
    const baseline = baselineFindings.get(key);
    if (!baseline) {
      newFindings.push(current);
      return;
    }
    if (resolvedStatuses.has(baseline.status) && !resolvedStatuses.has(current.status)) {
      reopenedFindings.push({ before: baseline, after: current });
      return;
    }
    persistentFindings.push({ before: baseline, after: current });
  });

  baselineFindings.forEach((baseline, key) => {
    if (!currentFindings.has(key) && !resolvedStatuses.has(baseline.status)) {
      correctedFindings.push(baseline);
    }
  });

  const newPorts = sorted(
    [...currentPorts.entries()]
      .filter(([port]) => !baselinePorts.has(port))
      .map(([, finding]) => finding)
  );
  const removedPorts = sorted(
    [...baselinePorts.entries()]
      .filter(([port]) => !currentPorts.has(port))
      .map(([, finding]) => finding)
  );
  const removedServices = sorted(
    [...baselinePorts.entries()]
      .filter(([port, finding]) => {
        const current = currentPorts.get(port);
        return !current || (normalize(finding.service) && normalize(finding.service) !== normalize(current.service));
      })
      .map(([, finding]) => finding)
  );
  const versionChanges = [...baselinePorts.entries()].flatMap(([port, baseline]) => {
    const current = currentPorts.get(port);
    if (
      !current ||
      normalize(baseline.service) !== normalize(current.service) ||
      !normalize(baseline.version) ||
      !normalize(current.version) ||
      normalize(baseline.version) === normalize(current.version)
    ) {
      return [];
    }
    return [{ port, service: current.service || baseline.service, before: baseline.version, after: current.version }];
  });

  const baselineRisk = Number(baselineAsset.riskScore) || 0;
  const currentRisk = Number(currentAsset.riskScore) || 0;
  const riskDelta = currentRisk - baselineRisk;

  return {
    baseline: {
      audit: baselineAsset.audit,
      asset: { id: baselineAsset.id, name: baselineAsset.name, ip: baselineAsset.ip },
      riskScore: baselineRisk,
      findingCount: baselineAsset.findings.length
    },
    current: {
      audit: currentAsset.audit,
      asset: { id: currentAsset.id, name: currentAsset.name, ip: currentAsset.ip },
      riskScore: currentRisk,
      findingCount: currentAsset.findings.length
    },
    summary: {
      newFindings: newFindings.length,
      persistentFindings: persistentFindings.length,
      correctedFindings: correctedFindings.length,
      reopenedFindings: reopenedFindings.length,
      newPorts: newPorts.length,
      removedPorts: removedPorts.length,
      removedServices: removedServices.length,
      versionChanges: versionChanges.length,
      riskDelta,
      riskTrend: riskDelta < 0 ? 'DECREASED' : riskDelta > 0 ? 'INCREASED' : 'UNCHANGED'
    },
    changes: {
      newFindings: sorted(newFindings),
      persistentFindings: sorted(persistentFindings),
      correctedFindings: sorted(correctedFindings),
      reopenedFindings: sorted(reopenedFindings),
      newPorts,
      removedPorts,
      removedServices,
      versionChanges
    }
  };
};
