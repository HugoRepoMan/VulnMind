import { processFindingPayload } from '../services/finding.service.js';

export const processFinding = async (req, res, next) => {
  try {
    const result = await processFindingPayload({
      actorUserId: req.user.id,
      payload: req.body,
      clientIdempotencyKey: req.get('Idempotency-Key')
    });

    res.status(result.idempotentReplay ? 200 : 202).json({
      success: true,
      message: result.idempotentReplay
        ? 'Hallazgo recuperado de una solicitud idempotente'
        : 'Hallazgo procesado e indexado',
      ...result
    });
  } catch (error) {
    next(error);
  }
};
