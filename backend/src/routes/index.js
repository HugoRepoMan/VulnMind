import { Router } from 'express';
import { processFinding } from '../controllers/finding.controller.js';
import { getStats, getRecentFindings } from '../controllers/dashboard.controller.js';
import { getSession, login } from '../controllers/auth.controller.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Routes index' });
});

router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getSession);

// Endpoint para obtener métricas del dashboard
router.get(
  '/dashboard/stats',
  requireAuth,
  allowRoles('ADMIN', 'AUDITOR', 'VIEWER'),
  getStats
);

// Endpoint para obtener hallazgos recientes
router.get(
  '/findings/recent',
  requireAuth,
  allowRoles('ADMIN', 'AUDITOR', 'VIEWER'),
  getRecentFindings
);

// Endpoint para procesar un nuevo hallazgo mediante el Motor Inteligente
router.post(
  '/findings',
  requireAuth,
  allowRoles('ADMIN', 'AUDITOR'),
  processFinding
);

export default router;
