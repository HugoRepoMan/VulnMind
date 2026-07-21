import Dexie from 'dexie';

export const db = new Dexie('VulnMindDB');

db.version(1).stores({
  audits: '++id, name, createdAt, status', // Local audits (offline first)
  findings: '++id, auditId, assetId, rawData, syncStatus', // syncStatus: 'pending' | 'synced' | 'failed'
});
