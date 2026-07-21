import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
  console.error('[Error]:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.errors
    });
  }

  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    return res.status(400).json({
      success: false,
      message: 'Database Error',
      code: err.code
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message
  });
};
