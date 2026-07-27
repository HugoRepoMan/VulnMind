import api from '@/services/api';
import { db } from '@/db';
import { useAppStore } from '@/store';

const RETRY_BASE_MS = 5000;
let activeSync = null;

const userId = () => useAppStore.getState().user?.id;

export const enqueueFinding = async ({ payload, idempotencyKey }) => {
  const record = {
    id: crypto.randomUUID(),
    userId: userId(),
    kind: 'CREATE_FINDING',
    payload,
    idempotencyKey,
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.syncQueue.add(record);
  return record;
};

const syncQueue = async () => {
  const currentUserId = userId();
  if (!currentUserId || !navigator.onLine) return { synced: 0, failed: 0 };

  const entries = await db.syncQueue
    .where('userId')
    .equals(currentUserId)
    .filter((entry) =>
      ['pending', 'failed'].includes(entry.status) &&
      entry.nextAttemptAt <= Date.now()
    )
    .sortBy('createdAt');
  const summary = { synced: 0, failed: 0 };

  for (const entry of entries) {
    await db.syncQueue.update(entry.id, { status: 'syncing', updatedAt: Date.now() });
    try {
      const response = await api.post('/findings', entry.payload, {
        headers: { 'Idempotency-Key': entry.idempotencyKey }
      });
      await db.syncQueue.update(entry.id, {
        status: 'synced',
        serverId: response.data.data.id,
        lastError: null,
        updatedAt: Date.now()
      });
      summary.synced += 1;
    } catch (error) {
      const attempts = entry.attempts + 1;
      const conflict = [404, 409].includes(error.response?.status);
      await db.syncQueue.update(entry.id, {
        status: conflict ? 'conflict' : 'failed',
        attempts,
        lastError: error.response?.data?.message || error.message || 'Error de red',
        nextAttemptAt: Date.now() + Math.min(300000, RETRY_BASE_MS * (2 ** attempts)),
        updatedAt: Date.now()
      });
      summary.failed += 1;
      if (!error.response) break;
    }
  }
  return summary;
};

export const syncPendingFindings = () => {
  if (!activeSync) {
    activeSync = syncQueue().finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
};

export const retryQueueItem = async (id, useNewIdempotencyKey = false) => {
  const changes = {
    status: 'pending',
    nextAttemptAt: Date.now(),
    lastError: null,
    updatedAt: Date.now()
  };
  if (useNewIdempotencyKey) changes.idempotencyKey = crypto.randomUUID();
  await db.syncQueue.update(id, changes);
  return syncPendingFindings();
};

export const discardQueueItem = (id) => db.syncQueue.delete(id);

export const saveFindingDraft = (draft) => {
  const currentUserId = userId();
  if (!currentUserId) return Promise.resolve();
  return db.drafts.put({
    id: `finding:${currentUserId}`,
    userId: currentUserId,
    value: draft,
    updatedAt: Date.now()
  });
};

export const loadFindingDraft = async () => {
  const currentUserId = userId();
  if (!currentUserId) return null;
  return (await db.drafts.get(`finding:${currentUserId}`))?.value ?? null;
};

export const clearFindingDraft = () => {
  const currentUserId = userId();
  if (!currentUserId) return Promise.resolve();
  return db.drafts.delete(`finding:${currentUserId}`);
};
