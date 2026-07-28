/**
 * Reglas de autenticación: registro VIEWER, bcrypt, emisión de JWT y consulta
 * de la sesión. Las respuestas públicas nunca incluyen passwordHash.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma.js';

const TOKEN_ISSUER = 'vulnmind-api';
const TOKEN_AUDIENCE = 'vulnmind-web';
const TOKEN_EXPIRES_IN = '8h';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is required');
    error.statusCode = 503;
    throw error;
  }

  return process.env.JWT_SECRET;
};

const publicUser = ({ id, email, role, active, createdAt }) => ({
  id,
  email,
  role,
  active,
  createdAt
});

export const registerViewer = async (email, password) => {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true }
  });
  if (existing) {
    const error = new Error('Ya existe una cuenta con este correo.');
    error.statusCode = 409;
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  // Cuenta y AuditLog se confirman juntos para no perder trazabilidad.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'VIEWER',
        active: true
      }
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_SELF_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        details: { email: user.email, assignedRole: 'VIEWER' }
      }
    });
    return publicUser(user);
  });
};

export const authenticateUser = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  // Un único mensaje evita revelar si un correo existe o está desactivado.
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    getJwtSecret(),
    {
      expiresIn: TOKEN_EXPIRES_IN,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    }
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'Session',
      entityId: user.id
    }
  });

  return { token, expiresIn: TOKEN_EXPIRES_IN, user: publicUser(user) };
};

export const verifyAccessToken = (token) =>
  jwt.verify(token, getJwtSecret(), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  });

export const findPublicUserById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  return user?.active ? publicUser(user) : null;
};
