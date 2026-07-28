import { readFile } from 'node:fs/promises';
import { parseJsonImport } from '../src/services/import-parser.service.js';
import { transformPersistedAttackGraph } from '../src/services/attack-graph.service.js';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/verify-attack-graph.js <findings.json>');

const records = parseJsonImport(await readFile(filename, 'utf8'));
const valid = records.filter(({ error }) => !error);
const auditId = 'verification-audit';
const assetsByName = new Map();
valid.forEach(({ asset }) => {
  if (!assetsByName.has(asset.name)) {
    assetsByName.set(asset.name, {
      ...asset,
      id: `verification:${asset.name}`,
      auditId,
      riskScore: 0
    });
  }
});
const assets = [...assetsByName.values()];
const findings = valid.map(({ asset: importedAsset, rawData }, index) => {
  const linkedAsset = assetsByName.get(importedAsset.name);
  const riskScore = rawData.vulnerability ? 80 : 45;
  linkedAsset.riskScore = Math.max(linkedAsset.riskScore, riskScore);
  return {
    id: rawData.externalId || `verification-finding-${index + 1}`,
    assetId: linkedAsset.id,
    asset: linkedAsset,
    port: rawData.port,
    vulnerability: rawData.vulnerability,
    severity: riskScore >= 70 ? 'HIGH' : 'MEDIUM',
    riskScore,
    rawData,
    analysis: {
      inferredService: rawData.service,
      inferredVersion: rawData.version,
      correlation: null,
      rules: []
    }
  };
});

const graph = transformPersistedAttackGraph({ findings, assets, auditId });
process.stdout.write(`${JSON.stringify({
  inputRecords: records.length,
  rejectedRecords: records.filter(({ error }) => error).length,
  summary: graph.summary,
  nodes: graph.nodes.map(({ id, type, label }) => ({ id, type, label })),
  edges: graph.edges.map(({ id, source, target, type }) => ({ id, source, target, type })),
  routes: graph.routes.map(({ id, name, nodeIds, edgeIds }) => ({ id, name, nodeIds, edgeIds }))
}, null, 2)}\n`);
