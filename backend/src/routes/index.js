/**
 * Matriz central de permisos HTTP. VIEWER sólo llega a datos del Dashboard;
 * AUDITOR trabaja con datos operativos y ADMIN además gestiona el sistema.
 */
import { Router } from 'express';
import { processFinding } from '../controllers/finding.controller.js';
import { getStats, getRecentFindings } from '../controllers/dashboard.controller.js';
import { getSession, login, register } from '../controllers/auth.controller.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import {
  createAsset, createAudit, createProject, deleteAsset, deleteAudit, deleteFinding,
  deleteProject, getAsset, getAudit, getFinding, getProject, listAssets, listAudits,
  listFindings, listProjects, updateAsset, updateAudit, updateFinding, updateProject
} from '../controllers/operations.controller.js';
import {
  createKnowledgeRule, deleteKnowledgeRule, getKnowledgeRule, importKnowledgeRules, listKnowledgeRules,
  updateKnowledgeRule
} from '../controllers/knowledge.controller.js';
import { importFindings } from '../controllers/import.controller.js';
import { exportFindings } from '../controllers/export.controller.js';
import { compareScans } from '../controllers/comparison.controller.js';
import { getAttackGraph } from '../controllers/attack-graph.controller.js';
import { getRemediationPriorities } from '../controllers/remediation.controller.js';
import {
  getNotificationConfiguration,
  subscribeToNotifications,
  unsubscribeFromNotifications
} from '../controllers/notification.controller.js';
import {
  createUser, listUsers, resetUserPassword, updateUser
} from '../controllers/user.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Routes index' });
});

router.post('/auth/login', login);
router.post('/auth/register', register);
router.get('/auth/me', requireAuth, getSession);

const dashboardRead = allowRoles('ADMIN', 'AUDITOR', 'VIEWER');
const operationalRead = allowRoles('ADMIN', 'AUDITOR');
const canWrite = allowRoles('ADMIN', 'AUDITOR');
const adminOnly = allowRoles('ADMIN');

router.get('/users', requireAuth, adminOnly, listUsers);
router.post('/users', requireAuth, adminOnly, createUser);
router.patch('/users/:userId', requireAuth, adminOnly, updateUser);
router.post('/users/:userId/reset-password', requireAuth, adminOnly, resetUserPassword);

router.get('/projects', requireAuth, dashboardRead, listProjects);
router.post('/projects', requireAuth, canWrite, createProject);
router.get('/projects/:projectId', requireAuth, operationalRead, getProject);
router.patch('/projects/:projectId', requireAuth, canWrite, updateProject);
router.delete('/projects/:projectId', requireAuth, adminOnly, deleteProject);
router.post('/projects/:projectId/audits', requireAuth, canWrite, createAudit);

router.get('/audits', requireAuth, dashboardRead, listAudits);
router.get('/audits/:auditId', requireAuth, operationalRead, getAudit);
router.patch('/audits/:auditId', requireAuth, canWrite, updateAudit);
router.delete('/audits/:auditId', requireAuth, adminOnly, deleteAudit);
router.post('/audits/:auditId/assets', requireAuth, canWrite, createAsset);

router.get('/assets', requireAuth, dashboardRead, listAssets);
router.get('/assets/:assetId', requireAuth, operationalRead, getAsset);
router.patch('/assets/:assetId', requireAuth, canWrite, updateAsset);
router.delete('/assets/:assetId', requireAuth, adminOnly, deleteAsset);

router.get('/findings', requireAuth, operationalRead, listFindings);
router.get('/findings/recent', requireAuth, dashboardRead, getRecentFindings);
router.get('/findings/:findingId', requireAuth, operationalRead, getFinding);
router.patch('/findings/:findingId', requireAuth, canWrite, updateFinding);
router.delete('/findings/:findingId', requireAuth, adminOnly, deleteFinding);

router.get('/knowledge/rules', requireAuth, operationalRead, listKnowledgeRules);
router.get('/knowledge/rules/:ruleId', requireAuth, operationalRead, getKnowledgeRule);
router.post('/knowledge/rules', requireAuth, adminOnly, createKnowledgeRule);
router.post('/knowledge/rules/import', requireAuth, adminOnly, importKnowledgeRules);
router.patch('/knowledge/rules/:ruleId', requireAuth, adminOnly, updateKnowledgeRule);
router.delete('/knowledge/rules/:ruleId', requireAuth, adminOnly, deleteKnowledgeRule);

router.post('/imports/findings', requireAuth, canWrite, importFindings);
router.get('/exports/findings', requireAuth, canWrite, exportFindings);
router.get('/comparisons/scans', requireAuth, operationalRead, compareScans);
router.get('/attack-graph', requireAuth, operationalRead, getAttackGraph);
router.get('/remediation-priorities', requireAuth, operationalRead, getRemediationPriorities);

router.get(
  '/notifications/configuration',
  requireAuth,
  operationalRead,
  getNotificationConfiguration
);
router.post(
  '/notifications/subscriptions',
  requireAuth,
  operationalRead,
  subscribeToNotifications
);
router.delete(
  '/notifications/subscriptions',
  requireAuth,
  operationalRead,
  unsubscribeFromNotifications
);

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
