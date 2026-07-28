/**
 * Valida los dos activos solicitados y delega la comparación entre escaneos al
 * servicio determinista; el controlador no inventa diferencias.
 */
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { compareAssetScans } from '../services/scan-comparison.service.js';

const comparisonSchema = z.object({
  baselineAssetId: z.string().trim().min(1),
  currentAssetId: z.string().trim().min(1)
}).refine(
  ({ baselineAssetId, currentAssetId }) => baselineAssetId !== currentAssetId,
  { message: 'Selecciona dos capturas diferentes' }
);

const comparisonInclude = {
  audit: {
    select: {
      id: true,
      name: true,
      projectId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true
    }
  },
  findings: {
    include: { analysis: true },
    orderBy: { createdAt: 'desc' }
  }
};

export const compareScans = async (req, res, next) => {
  try {
    const { baselineAssetId, currentAssetId } = comparisonSchema.parse(req.query);
    const [baselineAsset, currentAsset] = await Promise.all([
      prisma.asset.findUnique({ where: { id: baselineAssetId }, include: comparisonInclude }),
      prisma.asset.findUnique({ where: { id: currentAssetId }, include: comparisonInclude })
    ]);

    if (!baselineAsset || !currentAsset) {
      const error = new Error('No se encontró uno de los activos seleccionados');
      error.statusCode = 404;
      throw error;
    }
    if (baselineAsset.audit.projectId !== currentAsset.audit.projectId) {
      const error = new Error('Los escaneos deben pertenecer al mismo proyecto');
      error.statusCode = 400;
      throw error;
    }
    if (baselineAsset.audit.id === currentAsset.audit.id) {
      const error = new Error('Selecciona activos de dos auditorías diferentes');
      error.statusCode = 400;
      throw error;
    }

    res.json({
      success: true,
      data: compareAssetScans(baselineAsset, currentAsset)
    });
  } catch (error) {
    next(error);
  }
};
