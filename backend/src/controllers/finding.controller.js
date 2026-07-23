import { engine } from '../knowledge-engine/index.js';
import { store } from '../store/memory.js';
import { z } from 'zod';

const createFindingSchema = z.object({
  assetId: z.string(),
  rawData: z.record(z.any())
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
    
    // 3. Guardar en store en memoria
    const savedFinding = store.addFinding(validatedData, engineResult);
    
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
