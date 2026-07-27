import { z } from 'zod';

export const findingFilterSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  auditId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1).optional(),
  period: z.enum(['7d', '30d', '90d']).default('7d')
});

export const periodDays = (period) => Number(period.replace('d', ''));

export const buildFindingWhere = (filters, includePeriod = true) => {
  const auditFilter = {
    ...(filters.auditId ? { id: filters.auditId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {})
  };
  const where = {
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(Object.keys(auditFilter).length
      ? { asset: { audit: auditFilter } }
      : {})
  };

  if (includePeriod) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - periodDays(filters.period) + 1);
    where.createdAt = { gte: since };
  }
  return where;
};

export const buildAssetWhere = (filters) => ({
  ...(filters.assetId ? { id: filters.assetId } : {}),
  ...(filters.auditId || filters.projectId ? {
    audit: {
      ...(filters.auditId ? { id: filters.auditId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {})
    }
  } : {})
});
