import { Router } from 'express';
import { processFinding } from '../controllers/finding.controller.js';
import { getStats, getRecentFindings } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Routes index' });
});

// Endpoint para obtener métricas del dashboard
router.get('/dashboard/stats', getStats);

// Endpoint para obtener hallazgos recientes
router.get('/findings/recent', getRecentFindings);

// Endpoint para procesar un nuevo hallazgo mediante el Motor Inteligente
router.post('/findings', processFinding);

export default router;
