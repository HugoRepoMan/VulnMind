/**
 * Caso de uso central de hallazgos: valida, ejecuta el Motor y usa una huella
 * canónica para que un reintento no vuelva a insertar el mismo dato.
 */
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { engine } from '../knowledge-engine/index.js';
import {
  createFindingWithAnalysis,
  findFindingByIdempotencyKey
} from '../repositories/finding.repository.js';
import { sendCriticalFindingNotification } from './notification.service.js';

export const createFindingSchema = z.object({
  assetId: z.string().trim().min(1),
  rawData: z.object({
    port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
    os: z.string().trim().max(120).nullable().optional(),
    service: z.string().trim().max(120).nullable().optional(),
    version: z.string().trim().max(120).nullable().optional(),
    vulnerability: z.string().trim().max(160).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional()
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

export const fingerprintPayload = (payload) => createHash('sha256')
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

export const processFindingPayload = async ({
  actorUserId,
  payload,
  clientIdempotencyKey
}) => {
  const validatedData = createFindingSchema.parse(payload);
  const validatedKey = clientIdempotencyKey
    ? idempotencyKeySchema.parse(clientIdempotencyKey)
    : null;
  const idempotencyKey = scopeIdempotencyKey(actorUserId, validatedKey);
  const requestFingerprint = fingerprintPayload(validatedData);
  const replayed = await replayIfPresent(idempotencyKey, requestFingerprint);

  if (replayed) {
    return { data: replayed, idempotentReplay: true };
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
        actorUserId,
        idempotencyKey,
        requestFingerprint
      },
      engineResult
    );
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const concurrentReplay = await replayIfPresent(idempotencyKey, requestFingerprint);
      if (concurrentReplay) {
        return { data: concurrentReplay, idempotentReplay: true };
      }
    }
    throw error;
  }

  sendCriticalFindingNotification(savedFinding).catch((error) => {
    console.error('[Push notification error]:', error.message);
  });

  return { data: savedFinding, idempotentReplay: false };
};
