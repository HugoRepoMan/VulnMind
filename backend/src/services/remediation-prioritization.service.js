import { isExternallyReachable } from './attack-graph.service.js';

const criticalityWeight = { LOW: 0.75, MEDIUM: 1, HIGH: 1.25, CRITICAL: 1.5 };
const effortFactor = { LOW: 1, MEDIUM: 0.8, HIGH: 0.6 };
const normalize = (value) => String(value ?? '').trim().toLowerCase();

const maxRisk = (findings) => findings.reduce(
  (maximum, finding) => Math.max(maximum, Number(finding.riskScore) || 0),
  0
);

const addCandidate = (candidates, definition, finding) => {
  const current = candidates.get(definition.key) || {
    ...definition,
    affectedFindingIds: new Set()
  };
  current.affectedFindingIds.add(finding.id);
  candidates.set(definition.key, current);
};

export const prioritizeRemediations = ({ findings, graph }) => {
  const candidates = new Map();
  const findingsByAsset = new Map();

  findings.forEach((finding) => {
    const assetFindings = findingsByAsset.get(finding.assetId) || [];
    assetFindings.push(finding);
    findingsByAsset.set(finding.assetId, assetFindings);

    const rules = finding.analysis?.rules || [];
    const coveredRecommendations = new Set();
    rules.forEach((rule) => {
      coveredRecommendations.add(normalize(rule.recommendation));
      addCandidate(candidates, {
        key: `rule:${rule.id}`,
        ruleId: rule.id,
        title: rule.recommendation,
        source: 'KNOWLEDGE_RULE',
        remediationEffort: rule.remediationEffort || 'MEDIUM',
        dependencies: rule.dependencies || [],
        knowledgePriority: rule.priority || 0
      }, finding);
    });

    (finding.analysis?.recommendations || []).forEach((recommendation) => {
      if (coveredRecommendations.has(normalize(recommendation))) return;
      addCandidate(candidates, {
        key: `recommendation:${normalize(recommendation)}`,
        ruleId: null,
        title: recommendation,
        source: 'PERSISTED_ANALYSIS',
        remediationEffort: 'MEDIUM',
        dependencies: [],
        knowledgePriority: 0
      }, finding);
    });
  });

  const priorities = [...candidates.values()].map((candidate) => {
    const affectedIds = candidate.affectedFindingIds;
    const affectedFindings = findings.filter(({ id }) => affectedIds.has(id));
    const affectedAssets = new Map();
    let estimatedRiskReduction = 0;
    let criticalityWeightedReduction = 0;

    affectedFindings.forEach((finding) => {
      if (affectedAssets.has(finding.assetId)) return;
      const allAssetFindings = findingsByAsset.get(finding.assetId) || [];
      const remainingFindings = allAssetFindings.filter(({ id }) => !affectedIds.has(id));
      const before = maxRisk(allAssetFindings);
      const after = maxRisk(remainingFindings);
      const reduction = Math.max(0, before - after);
      const criticality = finding.asset.criticality || 'MEDIUM';
      const weight = criticalityWeight[criticality] || criticalityWeight.MEDIUM;
      estimatedRiskReduction += reduction;
      criticalityWeightedReduction += reduction * weight;
      affectedAssets.set(finding.assetId, {
        id: finding.asset.id,
        name: finding.asset.name,
        ip: finding.asset.ip,
        criticality,
        riskBefore: before,
        riskAfter: after,
        riskReduction: reduction
      });
    });

    const exposedAssetIds = new Set(
      affectedFindings
        .filter((finding) => isExternallyReachable(finding.asset, finding.rawData || {}))
        .map(({ assetId }) => assetId)
    );
    const affectedRouteIds = new Set(
      graph.routes
        .filter(({ findingId }) => affectedIds.has(findingId))
        .map(({ id }) => id)
    );
    const effort = candidate.remediationEffort in effortFactor
      ? candidate.remediationEffort
      : 'MEDIUM';
    const dependencies = candidate.dependencies || [];
    const components = {
      criticalityWeightedReduction: Math.round(criticalityWeightedReduction * 10) / 10,
      attackChainImpact: affectedRouteIds.size * 10,
      internetExposureImpact: exposedAssetIds.size * 8,
      relatedAssetImpact: affectedAssets.size * 3,
      knowledgePriorityImpact: candidate.knowledgePriority / 10,
      dependencyPenalty: dependencies.length * 2,
      effortFactor: effortFactor[effort]
    };
    const scoreBeforeEffort =
      components.criticalityWeightedReduction +
      components.attackChainImpact +
      components.internetExposureImpact +
      components.relatedAssetImpact +
      components.knowledgePriorityImpact -
      components.dependencyPenalty;
    const prioritizationScore = Math.max(
      0,
      Math.round(scoreBeforeEffort * components.effortFactor * 10) / 10
    );

    return {
      id: candidate.key,
      ruleId: candidate.ruleId,
      title: candidate.title,
      source: candidate.source,
      prioritizationScore,
      estimatedRiskReduction: Math.round(estimatedRiskReduction * 10) / 10,
      criticalityWeightedReduction: components.criticalityWeightedReduction,
      attackChainsBroken: affectedRouteIds.size,
      relatedAssets: affectedAssets.size,
      internetExposedAssets: exposedAssetIds.size,
      affectedFindings: affectedIds.size,
      remediationEffort: effort,
      dependencies,
      assets: [...affectedAssets.values()].sort((left, right) => right.riskReduction - left.riskReduction),
      components,
      explanation: [
        `Reduce ${Math.round(estimatedRiskReduction * 10) / 10} puntos de riesgo agregado según el máximo restante por activo.`,
        `Afecta ${affectedAssets.size} activo(s) y rompe ${affectedRouteIds.size} ruta(s) calculada(s).`,
        exposedAssetIds.size ? `Incluye ${exposedAssetIds.size} activo(s) con exposición externa confirmada.` : null,
        `Esfuerzo registrado: ${effort.toLowerCase()}.`
      ].filter(Boolean).join(' ')
    };
  }).filter(({ title }) => Boolean(title))
    .sort((left, right) =>
      right.prioritizationScore - left.prioritizationScore ||
      right.estimatedRiskReduction - left.estimatedRiskReduction
    )
    .map((item, index) => ({ ...item, priority: index + 1 }));

  return {
    priorities,
    summary: {
      recommendations: priorities.length,
      highestEstimatedRiskReduction: priorities[0]?.estimatedRiskReduction ?? 0,
      attackChainsAddressed: new Set(
        priorities.flatMap((item) =>
          graph.routes.filter(({ findingId }) =>
            candidates.get(item.id)?.affectedFindingIds.has(findingId)
          ).map(({ id }) => id)
        )
      ).size,
      analyzedFindings: findings.length,
      findingsWithoutRecommendation: findings.filter((finding) =>
        !(finding.analysis?.rules?.length || finding.analysis?.recommendations?.length)
      ).length
    },
    methodology: {
      riskReduction: 'Riesgo máximo actual del activo menos el riesgo máximo restante al resolver los hallazgos cubiertos.',
      criticalityWeights: criticalityWeight,
      effortFactors: effortFactor,
      attackChainPoints: 10,
      internetExposurePoints: 8,
      relatedAssetPoints: 3,
      dependencyPenalty: 2,
      formula: '(reducción ponderada + rutas×10 + exposición×8 + activos×3 + prioridadRegla÷10 − dependencias×2) × factorEsfuerzo'
    }
  };
};
