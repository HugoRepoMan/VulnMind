/**
 * Administración de cuentas. Permite promover, bloquear o renovar contraseña
 * sin borrar proyectos ni romper el historial del usuario.
 */
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';

const idSchema = z.string().trim().min(1);
const roleSchema = z.enum(['ADMIN', 'AUDITOR', 'VIEWER']);
const passwordSchema = z.string().min(10).max(200);
const createSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: passwordSchema,
  role: roleSchema.default('AUDITOR'),
  active: z.boolean().default(true)
});
const updateSchema = z.object({
  role: roleSchema.optional(),
  active: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});
const resetPasswordSchema = z.object({ password: passwordSchema });
const userSelect = {
  id: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { projects: true } }
};

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const ensureAdminRemains = async (tx, user, changes) => {
  // Impide dejar una instalación sin ninguna cuenta administradora activa.
  const removesActiveAdmin = user.role === 'ADMIN' && user.active &&
    (changes.role && changes.role !== 'ADMIN' || changes.active === false);
  if (!removesActiveAdmin) return;
  const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', active: true } });
  if (activeAdmins <= 1) fail('No se puede desactivar o cambiar el rol del último administrador activo.', 409);
};

export const listUsers = async (req, res, next) => {
  try {
    const data = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }]
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      fail('Ya existe una cuenta con este correo.', 409);
    }
    // Coste 12: cada intento de contraseña resulta deliberadamente costoso.
    const passwordHash = await bcrypt.hash(input.password, 12);
    const data = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: input.role,
          active: input.active
        },
        select: userSelect
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: user.id,
          details: { email: user.email, role: user.role, active: user.active }
        }
      });
      return user;
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.userId);
    const input = updateSchema.parse(req.body);
    if (id === req.user.id && input.active === false) {
      fail('No puedes desactivar tu propia cuenta.', 409);
    }
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) fail('Usuario no encontrado.', 404);
      await ensureAdminRemains(tx, current, input);
      const user = await tx.user.update({ where: { id }, data: input, select: userSelect });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          details: {
            changedFields: Object.keys(input),
            previousRole: current.role,
            role: user.role,
            active: user.active
          }
        }
      });
      return user;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.userId);
    const { password } = resetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { id: true, email: true } });
      if (!current) fail('Usuario no encontrado.', 404);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'USER_PASSWORD_RESET',
          entityType: 'User',
          entityId: id,
          details: { email: current.email }
        }
      });
      return { id, email: current.email };
    });
    res.json({ success: true, data, message: 'Contraseña restablecida.' });
  } catch (error) {
    next(error);
  }
};
