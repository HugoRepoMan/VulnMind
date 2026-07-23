import { prisma } from '../database/prisma.js';

const severityFromRisk = (riskScore) => {
  if (riskScore >= 70) return 'CRITICAL';
  if (riskScore >= 40) return 'HIGH';
  if (riskScore >= 20) return 'MEDIUM';
  return 'LOW';
};

const uniqueValues = (rules, field) => [
  ...new Set(rules.flatMap((rule) => rule[field] ?? []))
];

export const createFindingWithAnalysis = async (findingData, engineResult) =>
  prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: findingData.assetId },
      select: { id: true, auditId: true, audit: { select: { projectId: true } } }
    });

    if (!asset) {
      const error = new Error('Asset not found');
      error.statusCode = 404;
      throw error;
    }

    const severity = severityFromRisk(engineResult.calculatedRisk);
    const finding = await tx.finding.create({
      data: {
        assetId: findingData.assetId,
        rawData: findingData.rawData,
        vulnerability: engineResult.inferenceResult.vulnerability,
        port: engineResult.inferenceResult.port,
        status: 'OPEN',
        severity,
        riskScore: engineResult.calculatedRisk,
        processedAt: new Date(),
        analysis: {
          create: {
            inferredOs: engineResult.inferenceResult.os,
            inferredService: engineResult.inferenceResult.service,
            inferredVersion: engineResult.inferenceResult.version,
            calculatedRisk: engineResult.calculatedRisk,
            matchedRules: engineResult.matchedRules.map((rule) => ({
              id: rule.id,
              name: rule.name,
              type: rule.type,
              baseRiskScore: rule.baseRiskScore
            })),
            rules: {
              connect: engineResult.matchedRules.map(({ id }) => ({ id }))
            },
            mitreTechniques: uniqueValues(engineResult.matchedRules, 'mitreIds'),
            owaspCategories: uniqueValues(engineResult.matchedRules, 'owaspIds'),
            cweIds: uniqueValues(engineResult.matchedRules, 'cweIds'),
            recommendations: engineResult.recommendations,
            correlation: engineResult.correlation,
            explanation: engineResult.explanation
          }
        }
      },
      include: {
        asset: { select: { name: true } },
        analysis: true
      }
    });

    const assetRisk = await tx.finding.aggregate({
      where: { assetId: asset.id },
      _max: { riskScore: true }
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: { riskScore: assetRisk._max.riskScore ?? 0 }
    });

    await tx.auditLog.create({
      data: {
        projectId: asset.audit.projectId,
        auditId: asset.auditId,
        action: 'FINDING_PROCESSED',
        entityType: 'Finding',
        entityId: finding.id,
        details: {
          riskScore: engineResult.calculatedRisk,
          severity,
          matchedRuleIds: engineResult.matchedRules.map(({ id }) => id)
        }
      }
    });

    return serializeFinding(finding);
  });

const serializeFinding = (finding) => ({
  id: finding.id,
  assetId: finding.assetId,
  assetName: finding.asset.name,
  port: finding.port,
  vulnerability: finding.vulnerability,
  severity: finding.severity.charAt(0) + finding.severity.slice(1).toLowerCase(),
  riskScore: finding.riskScore,
  recommendations: finding.analysis?.recommendations ?? [],
  explanation: finding.analysis?.explanation ?? null,
  timestamp: finding.createdAt.toISOString()
});

export const findRecentFindings = async (limit = 10) => {
  const findings = await prisma.finding.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      asset: { select: { name: true } },
      analysis: { select: { recommendations: true, explanation: true } }
    }
  });

  return findings.map(serializeFinding);
};

export const findPreviousFindingsForAsset = (assetId, limit = 20) =>
  prisma.finding.findMany({
    where: { assetId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: { id: true, port: true, vulnerability: true, riskScore: true }
  });
