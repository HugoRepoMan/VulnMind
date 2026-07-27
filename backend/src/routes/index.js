import { Router } from 'express';
import { processFinding } from '../controllers/finding.controller.js';
import { getStats, getRecentFindings } from '../controllers/dashboard.controller.js';
import { getSession, login } from '../controllers/auth.controller.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  createAsset, createAudit, createProject, deleteAsset, deleteAudit, deleteFinding,
  deleteProject, getAsset, getAudit, getFinding, getProject, listAssets, listAudits,
  listFindings, listProjects, updateAsset, updateAudit, updateFinding, updateProject
} from '../controllers/operations.controller.js';
import {
  createKnowledgeRule, deleteKnowledgeRule, getKnowledgeRule, listKnowledgeRules,
  updateKnowledgeRule
} from '../controllers/knowledge.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Routes index' });
});

router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getSession);

const canRead = allowRoles('ADMIN', 'AUDITOR', 'VIEWER');
const canWrite = allowRoles('ADMIN', 'AUDITOR');
const adminOnly = allowRoles('ADMIN');

router.get('/projects', requireAuth, canRead, listProjects);
router.post('/projects', requireAuth, canWrite, createProject);
router.get('/projects/:projectId', requireAuth, canRead, getProject);
router.patch('/projects/:projectId', requireAuth, canWrite, updateProject);
router.delete('/projects/:projectId', requireAuth, adminOnly, deleteProject);
router.post('/projects/:projectId/audits', requireAuth, canWrite, createAudit);

router.get('/audits', requireAuth, canRead, listAudits);
router.get('/audits/:auditId', requireAuth, canRead, getAudit);
router.patch('/audits/:auditId', requireAuth, canWrite, updateAudit);
router.delete('/audits/:auditId', requireAuth, adminOnly, deleteAudit);
router.post('/audits/:auditId/assets', requireAuth, canWrite, createAsset);

router.get('/assets', requireAuth, canRead, listAssets);
router.get('/assets/:assetId', requireAuth, canRead, getAsset);
router.patch('/assets/:assetId', requireAuth, canWrite, updateAsset);
router.delete('/assets/:assetId', requireAuth, adminOnly, deleteAsset);

router.get('/findings', requireAuth, canRead, listFindings);
router.get('/findings/recent', requireAuth, canRead, getRecentFindings);
router.get('/findings/:findingId', requireAuth, canRead, getFinding);
router.patch('/findings/:findingId', requireAuth, canWrite, updateFinding);
router.delete('/findings/:findingId', requireAuth, adminOnly, deleteFinding);

router.get('/knowledge/rules', requireAuth, canRead, listKnowledgeRules);
router.get('/knowledge/rules/:ruleId', requireAuth, canRead, getKnowledgeRule);
router.post('/knowledge/rules', requireAuth, adminOnly, createKnowledgeRule);
router.patch('/knowledge/rules/:ruleId', requireAuth, adminOnly, updateKnowledgeRule);
router.delete('/knowledge/rules/:ruleId', requireAuth, adminOnly, deleteKnowledgeRule);

// Endpoint para obtener métricas del dashboard
router.get(
  '/dashboard/stats',
  requireAuth,
  allowRoles('ADMIN', 'AUDITOR', 'VIEWER'),
  getStats
);

// Endpoint para procesar un nuevo hallazgo mediante el Motor Inteligente
router.post(
  '/findings',
  requireAuth,
  allowRoles('ADMIN', 'AUDITOR'),
  processFinding
);

export default router;
