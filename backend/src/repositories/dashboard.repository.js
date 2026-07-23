import { prisma } from '../database/prisma.js';

export const getDashboardStats = async () => {
  const [assetAggregate, criticalFindings, analyses] = await Promise.all([
    prisma.asset.aggregate({
      _avg: { riskScore: true },
      _count: { id: true }
    }),
    prisma.finding.count({ where: { severity: 'CRITICAL' } }),
    prisma.findingAnalysis.findMany({ select: { matchedRules: true } })
  ]);

  const rulesMatched = analyses.reduce(
    (total, analysis) =>
      total + (Array.isArray(analysis.matchedRules) ? analysis.matchedRules.length : 0),
    0
  );

  return {
    globalRisk: Math.round(assetAggregate._avg.riskScore ?? 0),
    criticalFindings,
    totalAssets: assetAggregate._count.id,
    rulesMatched
  };
};
