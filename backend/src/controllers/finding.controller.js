import { engine } from '../knowledge-engine/index.js';
import { createFindingWithAnalysis } from '../repositories/finding.repository.js';
import { z } from 'zod';

const createFindingSchema = z.object({
  assetId: z.string().trim().min(1),
  rawData: z.record(z.string(), z.unknown())
});

export const processFinding = async (req, res, next) => {
  try {
    // 1. Validar payload
    const validatedData = createFindingSchema.parse(req.body);
    
    // 2. Ejecutar Motor Inteligente
    const engineResult = await engine.processFinding(
      validatedData.assetId,
      validatedData.rawData
    );
    
    // 3. Guardar atómicamente el hallazgo, análisis, riesgo y auditoría.
    const savedFinding = await createFindingWithAnalysis(
      { ...validatedData, actorUserId: req.user.id },
      engineResult
    );
    
    // 4. Responder al cliente inmediatamente
    res.status(202).json({
      success: true,
      message: 'Hallazgo procesado e indexado',
      data: savedFinding
    });
  } catch (error) {
    next(error); // Pasa al global error handler
  }
};
