import { engine } from '../knowledge-engine/index.js';
import {
  createFindingWithAnalysis, findFindingByIdempotencyKey
} from '../repositories/finding.repository.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

const createFindingSchema = z.object({
  assetId: z.string().trim().min(1),
  rawData: z.object({
    port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
    os: z.string().trim().max(120).nullable().optional(),
    service: z.string().trim().max(120).nullable().optional(),
    version: z.string().trim().max(120).nullable().optional(),
    vulnerability: z.string().trim().max(160).nullable().optional()
  }).passthrough()
});
const idempotencyKeySchema = z.string().trim().min(8).max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Invalid Idempotency-Key format');

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
};

const fingerprint = (payload) => createHash('sha256')
  .update(JSON.stringify(canonicalize(payload)))
  .digest('hex');
const scopeIdempotencyKey = (userId, key) => key
  ? createHash('sha256').update(`${userId}:${key}`).digest('hex')
  : null;

const idempotencyConflict = () => {
  const error = new Error('Idempotency-Key was already used with a different payload');
  error.statusCode = 409;
  return error;
};

const replayIfPresent = async (idempotencyKey, requestFingerprint) => {
  const existing = await findFindingByIdempotencyKey(idempotencyKey);
  if (!existing) return null;
  if (existing.finding.requestFingerprint !== requestFingerprint) throw idempotencyConflict();
  return existing.serialized;
};

export const processFinding = async (req, res, next) => {
  try {
    const validatedData = createFindingSchema.parse(req.body);
    const clientIdempotencyKey = req.get('Idempotency-Key')
      ? idempotencyKeySchema.parse(req.get('Idempotency-Key'))
      : null;
    const idempotencyKey = scopeIdempotencyKey(req.user.id, clientIdempotencyKey);
    const requestFingerprint = fingerprint(validatedData);
    const replayed = await replayIfPresent(idempotencyKey, requestFingerprint);
    if (replayed) {
      return res.status(200).json({
        success: true,
        message: 'Hallazgo recuperado de una solicitud idempotente',
        idempotentReplay: true,
        data: replayed
      });
    }

    const engineResult = await engine.processFinding(
      validatedData.assetId,
      validatedData.rawData
    );

    let savedFinding;
    try {
      savedFinding = await createFindingWithAnalysis(
        {
          ...validatedData,
          actorUserId: req.user.id,
          idempotencyKey,
          requestFingerprint
        },
        engineResult
      );
    } catch (error) {
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrentReplay = await replayIfPresent(idempotencyKey, requestFingerprint);
        if (concurrentReplay) {
          return res.status(200).json({
            success: true,
            message: 'Hallazgo recuperado de una solicitud idempotente concurrente',
            idempotentReplay: true,
            data: concurrentReplay
          });
        }
      }
      throw error;
    }

    res.status(202).json({
      success: true,
      message: 'Hallazgo procesado e indexado',
      idempotentReplay: false,
      data: savedFinding
    });
  } catch (error) {
    next(error); // Pasa al global error handler
  }
};
