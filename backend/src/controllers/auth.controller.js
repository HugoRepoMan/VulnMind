import { z } from 'zod';
import { authenticateUser } from '../services/auth.service.js';

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200)
});

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
