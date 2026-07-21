import { Router } from 'express';
import { processFinding } from '../controllers/finding.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Routes index' });
});

// Endpoint para procesar un nuevo hallazgo mediante el Motor Inteligente
router.post('/findings', processFinding);

export default router;
