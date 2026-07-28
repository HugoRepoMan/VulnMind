/**
 * Puerta pública de identidad. Aquí se valida el HTTP; el hash, PostgreSQL y
 * los JWT se delegan al servicio para no duplicar reglas de seguridad.
 */
import { z } from 'zod';
import { authenticateUser, registerViewer } from '../services/auth.service.js';

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200)
});
const registerSchema = z.object({
  // No existe `role`: cualquier rol enviado por el navegador se descarta.
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200)
});

export const register = async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const user = await registerViewer(input.email, input.password);
    res.status(201).json({
      success: true,
      message: 'Cuenta creada con acceso de solo lectura.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const session = await authenticateUser(credentials.email, credentials.password);

    res.json({
      success: true,
      message: 'Authenticated successfully',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const getSession = (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
};
