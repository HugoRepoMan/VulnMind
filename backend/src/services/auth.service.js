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

const publicUser = ({ id, email, role, createdAt }) => ({
  id,
  email,
  role,
  createdAt
});

export const authenticateUser = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
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
  return user ? publicUser(user) : null;
};
