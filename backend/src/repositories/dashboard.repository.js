import { prisma } from '../database/prisma.js';
import {
  buildAssetWhere,
  buildFindingWhere,
  periodDays
} from '../services/finding-filter.service.js';

const dateKey = (date) => date.toISOString().slice(0, 10);

const buildTrend = (findings, days) => {
  const daily = new Map();
  findings.forEach((finding) => {
    const key = dateKey(finding.createdAt);
    const current = daily.get(key) || { total: 0, count: 0, peak: 0 };
    current.total += finding.riskScore;
    current.count += 1;
    current.peak = Math.max(current.peak, finding.riskScore);
    daily.set(key, current);
  });

  const points = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    const current = daily.get(dateKey(date));
    points.push({
      date: dateKey(date),
      risk: current ? Math.round(current.total / current.count) : 0,
      peakRisk: current ? Math.round(current.peak) : 0,
      findings: current?.count ?? 0
    });
  }
  return points;
};

export const getDashboardStats = async (filters) => {
  const findingWhere = buildFindingWhere(filters);
  const [assets, findings, analyses] = await Promise.all([
    prisma.asset.count({ where: buildAssetWhere(filters) }),
    prisma.finding.findMany({
      where: findingWhere,
      select: {
        id: true,
        assetId: true,
        severity: true,
        riskScore: true,
        createdAt: true
      }
    }),
    prisma.findingAnalysis.findMany({
      where: { finding: findingWhere },
      select: { matchedRules: true }
    })
  ]);

  const rulesMatched = analyses.reduce(
    (total, analysis) =>
      total + (Array.isArray(analysis.matchedRules) ? analysis.matchedRules.length : 0),
    0
  );
  const riskTotal = findings.reduce((total, finding) => total + finding.riskScore, 0);

  return {
    globalRisk: findings.length ? Math.round(riskTotal / findings.length) : 0,
    criticalFindings: findings.filter(({ severity }) => severity === 'CRITICAL').length,
    totalAssets: assets,
    analyzedAssets: new Set(findings.map(({ assetId }) => assetId)).size,
    rulesMatched,
    totalFindings: findings.length,
    riskTrend: buildTrend(findings, periodDays(filters.period)),
    period: filters.period
  };
};
