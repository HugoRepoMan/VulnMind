import { transformPersistedAttackGraph } from './attack-graph.service.js';

const auditId = 'audit-current';
const asset = (overrides = {}) => ({
  id: 'web', auditId, name: 'web-prod-01', ip: '10.10.0.10',
  type: 'host', criticality: 'CRITICAL', riskScore: 80, ...overrides
});
const finding = (overrides = {}) => {
  const linkedAsset = overrides.asset || asset();
  return {
    id: 'finding-log4j',
    assetId: linkedAsset.id,
    asset: linkedAsset,
    port: 8080,
    vulnerability: 'CVE-2021-44228',
    severity: 'CRITICAL',
    riskScore: 90,
    rawData: {
      port: 8080,
      protocol: 'tcp',
      service: 'http',
      evidence: 'CVE-2021-44228 confirmed on Tomcat',
      internetExposed: true,
      externalId: 'VM-TEST-001',
      tags: ['initial-access', 'remote-code-execution'],
      ...overrides.rawData
    },
    analysis: {
      inferredService: 'http',
      inferredVersion: 'Apache Tomcat 9',
      correlation: null,
      rules: [],
      ...overrides.analysis
    },
    ...overrides,
    asset: linkedAsset,
    assetId: linkedAsset.id
  };
};
const build = (findings, assets = [asset()], selectedAudit = auditId) =>
  transformPersistedAttackGraph({ findings, assets, auditId: selectedAudit });

describe('semantic attack graph transformation', () => {
  test('does not duplicate an asset, service, or identical connection', () => {
    const second = finding({
      id: 'finding-http-2',
      vulnerability: null,
      rawData: {
        port: 8080, protocol: 'tcp', service: 'http',
        evidence: 'Second persisted observation', internetExposed: true
      }
    });
    const graph = build([finding(), second], [asset(), asset()]);

    expect(graph.nodes.filter(({ id }) => id === 'asset:web')).toHaveLength(1);
    expect(graph.nodes.filter(({ id }) => id === 'service:web:tcp:8080')).toHaveLength(1);
    expect(graph.edges.filter(({ source, target, type }) =>
      source === 'asset:web' && target === 'service:web:tcp:8080' && type === 'ASSET_SERVICE'
    )).toHaveLength(1);
    expect(new Set(graph.edges.map(({ id }) => id)).size).toBe(graph.edges.length);
  });

  test('connects Log4Shell only to the service whose finding contains its evidence', () => {
    const unrelated = finding({
      id: 'finding-ftp',
      port: 21,
      vulnerability: null,
      riskScore: 40,
      rawData: {
        port: 21, protocol: 'tcp', service: 'ftp',
        evidence: 'Port 21 open', internetExposed: true, tags: []
      },
      analysis: { inferredService: 'ftp', inferredVersion: 'vsftpd', correlation: null, rules: [] }
    });
    const graph = build([finding(), unrelated]);
    const log4j = graph.nodes.find(({ label }) => label === 'CVE-2021-44228');
    const incoming = graph.edges.filter(({ target }) => target === log4j.id);

    expect(log4j.id).toBe('vulnerability:finding-log4j:cve-2021-44228');
    expect(incoming).toHaveLength(1);
    expect(incoming[0].source).toBe('service:web:tcp:8080');
    expect(incoming.some(({ source }) => source === 'service:web:tcp:21')).toBe(false);
  });

  test('changing audit removes all nodes from the prior audit', () => {
    const priorAsset = asset({ id: 'old-web', auditId: 'audit-old', name: 'gateway' });
    const priorFinding = finding({ id: 'old-finding', asset: priorAsset });
    const graph = build([finding(), priorFinding], [asset(), priorAsset]);

    expect(graph.nodes.some(({ assetId }) => assetId === 'old-web')).toBe(false);
    expect(graph.nodes.some(({ auditId: nodeAudit }) => nodeAudit === 'audit-old')).toBe(false);
  });

  test('reprocessing the same persisted records is deterministic and idempotent', () => {
    const records = [finding()];
    const first = build(records);
    const second = build(records);

    expect(second.nodes.map(({ id }) => id)).toEqual(first.nodes.map(({ id }) => id));
    expect(second.edges.map(({ id }) => id)).toEqual(first.edges.map(({ id }) => id));
  });

  test('nodes without a demonstrable relation do not receive invented edges', () => {
    const isolatedAsset = asset({ id: 'isolated', name: 'isolated', ip: '10.0.0.50' });
    const isolatedFinding = finding({
      id: 'isolated-note',
      asset: isolatedAsset,
      port: null,
      vulnerability: null,
      rawData: { port: null, service: null, evidence: null, internetExposed: false, tags: [] },
      analysis: { inferredService: null, inferredVersion: null, correlation: null, rules: [] }
    });
    const graph = build([finding(), isolatedFinding], [asset(), isolatedAsset]);
    const isolatedNode = graph.nodes.find(({ id }) => id === 'asset:isolated');

    expect(isolatedNode).toBeDefined();
    expect(graph.edges.some(({ source, target }) =>
      source === isolatedNode.id || target === isolatedNode.id
    )).toBe(false);
  });

  test('stable semantic IDs do not use array indexes', () => {
    const graph = build([finding()]);
    expect(graph.nodes.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'origin:internet',
      'asset:web',
      'service:web:tcp:8080',
      'vulnerability:finding-log4j:cve-2021-44228',
      'evidence:finding-log4j'
    ]));
  });
});
