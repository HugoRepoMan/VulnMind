/**
 * Importación Nmap/CSV/JSON. Normaliza cada fila y la procesa con el mismo Motor
 * Inteligente de la creación manual, conservando idempotencia por contenido.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { parseImport } from '../services/import-parser.service.js';
import { processFindingPayload } from '../services/finding.service.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const importSchema = z.object({
  auditId: z.string().trim().min(1),
  format: z.enum(['nmap', 'csv', 'json']),
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1)
}).superRefine((value, context) => {
  if (Buffer.byteLength(value.content, 'utf8') > MAX_FILE_BYTES) {
    context.addIssue({
      code: 'custom',
      path: ['content'],
      message: 'El archivo supera el límite de 3 MB'
    });
  }
});

const ensureAsset = async ({ audit, asset, actorUserId }) => {
  const existing = await prisma.asset.findFirst({
    where: {
      auditId: audit.id,
      OR: [
        { name: asset.name },
        ...(asset.ip ? [{ ip: asset.ip }] : [])
      ]
    }
  });
  if (existing) return { asset: existing, created: false };

  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.asset.create({
      data: {
        auditId: audit.id,
        name: asset.name,
        ip: asset.ip,
        type: asset.type,
        criticality: asset.criticality
      }
    });
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        projectId: audit.projectId,
        auditId: audit.id,
        action: 'ASSET_IMPORTED',
        entityType: 'Asset',
        entityId: saved.id,
        details: { name: saved.name, ip: saved.ip }
      }
    });
    return saved;
  });

  return { asset: created, created: true };
};

export const importFindings = async (req, res, next) => {
  try {
    const payload = importSchema.parse(req.body);
    const audit = await prisma.audit.findUnique({
      where: { id: payload.auditId },
      select: { id: true, projectId: true }
    });
    if (!audit) {
      const error = new Error('Audit not found');
      error.statusCode = 404;
      throw error;
    }

    let records;
    try {
      records = parseImport(payload.format, payload.content);
    } catch (error) {
      error.statusCode = 400;
      throw error;
    }
    const fileHash = createHash('sha256').update(payload.content).digest('hex');
    const summary = {
      filename: payload.filename,
      format: payload.format,
      total: records.length,
      accepted: 0,
      replayed: 0,
      rejected: 0,
      assetsCreated: 0,
      errors: []
    };

    for (const record of records) {
      if (record.error) {
        summary.rejected += 1;
        summary.errors.push({ source: record.sourceIndex, message: record.error });
        continue;
      }

      try {
        const assetResult = await ensureAsset({
          audit,
          asset: record.asset,
          actorUserId: req.user.id
        });
        if (assetResult.created) summary.assetsCreated += 1;
        const result = await processFindingPayload({
          actorUserId: req.user.id,
          payload: {
            assetId: assetResult.asset.id,
            rawData: {
              ...record.rawData,
              importSource: payload.format,
              importReference: String(record.sourceIndex)
            }
          },
          clientIdempotencyKey: `import:${fileHash.slice(0, 40)}:${record.sourceIndex}`
        });
        if (result.idempotentReplay) summary.replayed += 1;
        else summary.accepted += 1;
      } catch (error) {
        summary.rejected += 1;
        summary.errors.push({
          source: record.sourceIndex,
          message: error.statusCode && error.statusCode < 500
            ? error.message
            : 'No se pudo procesar el registro'
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        projectId: audit.projectId,
        auditId: audit.id,
        action: 'FINDINGS_IMPORTED',
        entityType: 'Audit',
        entityId: audit.id,
        details: {
          filename: payload.filename,
          format: payload.format,
          total: summary.total,
          accepted: summary.accepted,
          replayed: summary.replayed,
          rejected: summary.rejected,
          assetsCreated: summary.assetsCreated
        }
      }
    });

    res.status(summary.rejected ? 207 : 200).json({
      success: summary.accepted + summary.replayed > 0,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
