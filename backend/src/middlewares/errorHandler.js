/**
 * Traduce fallos internos a JSON: validación→400, conflicto Prisma→409,
 * statusCode de negocio→su código y errores inesperados→500.
 */
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler = (err, req, res, next) => {
  console.error('[Error]:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.issues
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const statusByCode = {
      P2002: 409,
      P2003: 409,
      P2025: 404
    };

    return res.status(statusByCode[err.code] ?? 400).json({
      success: false,
      message: 'Database operation failed',
      code: err.code
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable'
    });
  }

  const statusCode = err.statusCode ?? 500;
  const message = err.statusCode ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message
  });
};
