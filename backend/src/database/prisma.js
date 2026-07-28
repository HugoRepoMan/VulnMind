/**
 * Cliente Prisma compartido. Una instancia evita abrir un pool nuevo por cada
 * controlador y el adaptador conecta todas las consultas con PostgreSQL.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const globalForPrisma = globalThis;
const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.__vulnMindPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__vulnMindPrisma = prisma;
}

export const disconnectPrisma = () => prisma.$disconnect();
