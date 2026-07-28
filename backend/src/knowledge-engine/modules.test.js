import InferenceEngine from './inference/index.js';
import ScoringEngine from './scoring/index.js';
import RecommendationsEngine from './recommendations/index.js';
import ExplainabilityEngine from './explainability/index.js';
import { buildCorrelation } from './correlation/index.js';
import { matchesCondition } from '../repositories/knowledge.repository.js';

describe('knowledge engine modules', () => {
  test('normalizes raw inference fields', async () => {
    await expect(InferenceEngine.analyze('asset-1', {
      port: '443',
      service: 'https',
      vulnerability: 'CVE-2025-0001'
    })).resolves.toMatchObject({
      assetId: 'asset-1',
      port: 443,
      service: 'https',
      vulnerability: 'CVE-2025-0001'
    });
  });

  test('matches scalar and array knowledge conditions', () => {
    const inference = { port: 443, service: 'https', tags: ['credential-reuse', 'external'] };
    expect(matchesCondition({ port: 443 }, inference)).toBe(true);
    expect(matchesCondition({ service: ['http', 'https'] }, inference)).toBe(true);
    expect(matchesCondition({ tagsAny: ['database-exposure', 'credential-reuse'] }, inference)).toBe(true);
    expect(matchesCondition({ tagsAll: ['credential-reuse', 'external'] }, inference)).toBe(true);
    expect(matchesCondition({ port: 22 }, inference)).toBe(false);
  });

  test('caps scoring at 100 and keeps every contribution', async () => {
    const result = await ScoringEngine.calculateRisk('asset-1', [
      { id: 'one', name: 'One', baseRiskScore: 80, priority: 2 },
      { id: 'two', name: 'Two', baseRiskScore: 40, priority: 1 }
    ]);
    expect(result).toMatchObject({ rawScore: 120, finalScore: 100, capped: true });
    expect(result.contributions).toHaveLength(2);
  });

  test('correlates repeated vulnerabilities, critical history and exposed services', () => {
    const result = buildCorrelation(
      { port: 443, vulnerability: 'CVE-2025-0001' },
      [
        { id: 'one', port: 80, vulnerability: 'CVE-2025-0001', riskScore: 75 },
        { id: 'two', port: 22, vulnerability: null, riskScore: 20 }
      ]
    );
    expect(result.escalationRisk).toBe(true);
    expect(result.signals.map(({ type }) => type)).toEqual([
      'REPEATED_VULNERABILITY',
      'CRITICAL_HISTORY',
      'MULTIPLE_EXPOSED_SERVICES'
    ]);
  });

  test('deduplicates recommendations and adds containment for escalation', async () => {
    const recommendations = await RecommendationsEngine.generate(
      [
        { recommendation: 'Cerrar puerto' },
        { recommendation: 'Cerrar puerto' }
      ],
      { escalationRisk: true }
    );
    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toContain('ACCIÓN INMEDIATA');
  });

  test('explains contributions and capped risk', async () => {
    const explanation = await ExplainabilityEngine.generateExplanation(
      {
        finalScore: 100,
        rawScore: 120,
        capped: true,
        contributions: [{ ruleName: 'Regla crítica', score: 120 }]
      },
      [{ id: 'rule' }],
      { escalationRisk: false }
    );
    expect(explanation).toContain('Regla crítica aportó 120 puntos');
    expect(explanation).toContain('se limitó al máximo de 100');
  });
});
