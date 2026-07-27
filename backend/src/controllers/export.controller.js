import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import {
  buildFindingWhere,
  findingFilterSchema
} from '../services/finding-filter.service.js';

const exportSchema = findingFilterSchema.extend({
  format: z.enum(['csv', 'json']).default('csv')
});

const csvCell = (value) => {
  let text = value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const serializeExportFinding = (finding) => ({
  id: finding.id,
  project: finding.asset.audit.project.name,
  audit: finding.asset.audit.name,
  asset: finding.asset.name,
  ip: finding.asset.ip,
  port: finding.port,
  vulnerability: finding.vulnerability,
  status: finding.status,
  severity: finding.severity,
  riskScore: finding.riskScore,
  evidence: finding.rawData,
  explanation: finding.analysis?.explanation ?? null,
  recommendations: finding.analysis?.recommendations ?? [],
  matchedRules: finding.analysis?.matchedRules ?? [],
  correlation: finding.analysis?.correlation ?? null,
  processedAt: finding.processedAt,
  createdAt: finding.createdAt
});

const toCsv = (rows) => {
  const headers = [
    'id', 'project', 'audit', 'asset', 'ip', 'port', 'vulnerability', 'status',
    'severity', 'riskScore', 'evidence', 'explanation', 'recommendations',
    'matchedRules', 'correlation', 'processedAt', 'createdAt'
  ];
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ].join('\r\n');
};

export const exportFindings = async (req, res, next) => {
  try {
    const filters = exportSchema.parse(req.query);
    const findings = await prisma.finding.findMany({
      where: buildFindingWhere(filters),
      take: 10000,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: {
          include: {
            audit: { include: { project: { select: { id: true, name: true } } } }
          }
        },
        analysis: true
      }
    });
    const rows = findings.map(serializeExportFinding);
    const filename = `vulnmind-findings-${new Date().toISOString().slice(0, 10)}.${filters.format}`;
    const body = filters.format === 'json'
      ? JSON.stringify({
        generatedAt: new Date().toISOString(),
        filters,
        count: rows.length,
        findings: rows
      }, null, 2)
      : toCsv(rows);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        projectId: filters.projectId,
        auditId: filters.auditId,
        action: 'FINDINGS_EXPORTED',
        entityType: 'FindingExport',
        details: {
          format: filters.format,
          count: rows.length,
          filters: {
            projectId: filters.projectId,
            auditId: filters.auditId,
            assetId: filters.assetId,
            period: filters.period
          }
        }
      }
    });

    res
      .set('Content-Type', filters.format === 'json'
        ? 'application/json; charset=utf-8'
        : 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .set('X-Export-Count', String(rows.length))
      .send(filters.format === 'csv' ? `\uFEFF${body}` : body);
  } catch (error) {
    next(error);
  }
};
