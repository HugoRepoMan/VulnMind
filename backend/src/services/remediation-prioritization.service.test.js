import { prioritizeRemediations } from './remediation-prioritization.service.js';

const rule = ({
  id, recommendation, effort = 'MEDIUM', dependencies = [], priority = 0
}) => ({
  id,
  recommendation,
  remediationEffort: effort,
  dependencies,
  priority
});

const finding = ({
  id, asset, riskScore, matchedRule, exposure
}) => ({
  id,
  assetId: asset.id,
  asset,
  riskScore,
  rawData: exposure ? { exposure } : {},
  analysis: {
    rules: [matchedRule],
    recommendations: [matchedRule.recommendation]
  }
});

describe('remediation prioritization service', () => {
  test('ranks persisted recommendations by marginal risk and operational context', () => {
    const gateway = {
      id: 'gateway', name: 'gateway', ip: '10.0.0.1',
      type: 'host', criticality: 'CRITICAL', riskScore: 55
    };
    const web = {
      id: 'web', name: 'web-prod', ip: '203.0.113.10',
      type: 'host', criticality: 'MEDIUM', riskScore: 80
    };
    const ftpRule = rule({
      id: 'ftp-rule',
      recommendation: 'Cerrar FTP',
      effort: 'LOW',
      dependencies: ['Ventana de red']
    });
    const webRule = rule({
      id: 'web-rule',
      recommendation: 'Actualizar aplicación web',
      effort: 'HIGH'
    });
    const findings = [
      finding({ id: 'ftp', asset: gateway, riskScore: 55, matchedRule: ftpRule, exposure: 'external' }),
      finding({
        id: 'http', asset: gateway, riskScore: 40,
        matchedRule: rule({ id: 'http-rule', recommendation: 'Aplicar cabeceras seguras' })
      }),
      finding({ id: 'web-vulnerability', asset: web, riskScore: 80, matchedRule: webRule })
    ];
    const graph = {
      routes: findings.map(({ id }) => ({ id: `route:${id}`, findingId: id }))
    };

    const result = prioritizeRemediations({ findings, graph });
    const ftp = result.priorities.find(({ ruleId }) => ruleId === 'ftp-rule');
    const application = result.priorities.find(({ ruleId }) => ruleId === 'web-rule');

    expect(ftp).toMatchObject({
      estimatedRiskReduction: 15,
      criticalityWeightedReduction: 22.5,
      attackChainsBroken: 1,
      relatedAssets: 1,
      internetExposedAssets: 1,
      remediationEffort: 'LOW',
      dependencies: ['Ventana de red']
    });
    expect(application.estimatedRiskReduction).toBe(80);
    expect(result.priorities[0].ruleId).toBe('web-rule');
    expect(result.methodology.formula).toContain('factorEsfuerzo');
  });

  test('reports findings that have no persisted remediation', () => {
    const asset = {
      id: 'uncovered', name: 'legacy', ip: '10.0.0.4',
      type: 'host', criticality: 'MEDIUM', riskScore: 20
    };
    const result = prioritizeRemediations({
      findings: [{
        id: 'finding-without-rule',
        assetId: asset.id,
        asset,
        riskScore: 20,
        rawData: {},
        analysis: { rules: [], recommendations: [] }
      }],
      graph: { routes: [] }
    });

    expect(result.priorities).toHaveLength(0);
    expect(result.summary.findingsWithoutRecommendation).toBe(1);
  });
});
