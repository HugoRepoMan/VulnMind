import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { buildAttackGraph } from '../services/attack-graph.service.js';

const filtersSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  auditId: z.string().trim().min(1)
});

export const getAttackGraph = async (req, res, next) => {
  try {
    const filters = filtersSchema.parse(req.query);
    const where = {
      status: { in: ['OPEN', 'IN_REVIEW', 'ACCEPTED'] },
      asset: {
        auditId: filters.auditId,
        ...(filters.projectId ? { audit: { projectId: filters.projectId } } : {})
      }
    };
    const assetWhere = {
      auditId: filters.auditId,
      ...(filters.projectId ? { audit: { projectId: filters.projectId } } : {})
    };

    const [findings, assets] = await Promise.all([
      prisma.finding.findMany({
        where,
        take: 250,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        include: {
          asset: {
            select: {
              id: true, name: true, ip: true, type: true, riskScore: true,
              criticality: true, auditId: true
            }
          },
          analysis: {
            select: {
              inferredService: true,
              inferredVersion: true,
              correlation: true,
              matchedRules: true,
              rules: { select: { name: true } }
            }
          }
        }
      }),
      prisma.asset.findMany({
        where: assetWhere,
        select: {
          id: true, name: true, ip: true, type: true, riskScore: true,
          criticality: true, auditId: true
        }
      })
    ]);

    const graph = buildAttackGraph({ findings, assets, auditId: filters.auditId });
    res.json({
      success: true,
      data: {
        ...graph,
        filters,
        truncated: findings.length === 250
      }
    });
  } catch (error) {
    next(error);
  }
};
