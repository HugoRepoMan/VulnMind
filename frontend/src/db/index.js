import Dexie from 'dexie';

export const db = new Dexie('VulnMindDB');

db.version(1).stores({
  audits: '++id, name, createdAt, status',
  findings: '++id, auditId, assetId, rawData, syncStatus'
});

db.version(2).stores({
  audits: '++id, name, createdAt, status',
  findings: '++id, auditId, assetId, rawData, syncStatus',
  drafts: '&id, userId, updatedAt',
  syncQueue: '&id, userId, status, nextAttemptAt, createdAt, [userId+status]'
});
