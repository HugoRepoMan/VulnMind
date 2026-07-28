/**
 * Reúne hallazgos, reglas y activos persistidos para calcular qué correcciones
 * reducen más riesgo dentro del filtro solicitado.
 */
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { buildAttackGraph } from '../services/attack-graph.service.js';
import { prioritizeRemediations } from '../services/remediation-prioritization.service.js';

const filtersSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  auditId: z.string().trim().min(1).optional()
});

export const getRemediationPriorities = async (req, res, next) => {
  try {
    const filters = filtersSchema.parse(req.query);
    const findingWhere = {
      status: { in: ['OPEN', 'IN_REVIEW', 'ACCEPTED'] },
      ...(filters.auditId ? { asset: { auditId: filters.auditId } } :
        filters.projectId ? { asset: { audit: { projectId: filters.projectId } } } : {})
    };
    const assetWhere = filters.auditId
      ? { auditId: filters.auditId }
      : filters.projectId ? { audit: { projectId: filters.projectId } } : {};
    const [findings, assets] = await Promise.all([
      prisma.finding.findMany({
        where: findingWhere,
        take: 250,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        include: {
          asset: {
            select: {
              id: true, name: true, ip: true, type: true, criticality: true, riskScore: true
            }
          },
          analysis: {
            include: {
              rules: true
            }
          }
        }
      }),
      prisma.asset.findMany({
        where: assetWhere,
        select: {
          id: true, name: true, ip: true, type: true, criticality: true, riskScore: true
        }
      })
    ]);
    const graph = buildAttackGraph({ findings, assets });
    const result = prioritizeRemediations({ findings, graph });

    res.json({
      success: true,
      data: {
        ...result,
        filters,
        truncated: findings.length === 250
      }
    });
  } catch (error) {
    next(error);
  }
};
