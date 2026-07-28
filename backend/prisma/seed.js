import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ids = {
  // IDs fijos: permiten ejecutar el seed varias veces sin crear cuentas duplicadas.
  user: '00000000-0000-4000-8000-000000000001',
  auditor: '00000000-0000-4000-8000-000000000004',
  viewer: '00000000-0000-4000-8000-000000000005',
  project: '00000000-0000-4000-8000-000000000002',
  audit: '00000000-0000-4000-8000-000000000003'
};

async function main() {
  // Estas cuentas existen sólo para desarrollo y demostración local. Cada
  // contraseña se cifra antes de tocar PostgreSQL; nunca se guarda texto plano.
  const developmentUsers = [
    {
      id: ids.user,
      email: 'admin@vulnmind.local',
      password: 'vulnmind-dev-only',
      role: 'ADMIN'
    },
    {
      id: ids.auditor,
      email: 'auditor@vulnmind.local',
      password: 'auditor-dev-only',
      role: 'AUDITOR'
    },
    {
      id: ids.viewer,
      email: 'viewer@vulnmind.local',
      password: 'viewer-dev-only',
      role: 'VIEWER'
    }
  ];

  for (const developmentUser of developmentUsers) {
    const { password, ...userData } = developmentUser;
    const passwordHash = await bcrypt.hash(password, 12);
    // upsert restaura rol, contraseña y estado si la base ya tenía la cuenta.
    await prisma.user.upsert({
      where: { email: userData.email },
      update: { passwordHash, role: userData.role, active: true },
      create: { ...userData, passwordHash, active: true }
    });
  }

  await prisma.project.upsert({
    where: { id: ids.project },
    update: { name: 'Proyecto de desarrollo' },
    create: {
      id: ids.project,
      ownerId: ids.user,
      name: 'Proyecto de desarrollo',
      description: 'Datos mínimos locales de VulnMind'
    }
  });

  await prisma.audit.upsert({
    where: { id: ids.audit },
    update: { status: 'IN_PROGRESS' },
    create: {
      id: ids.audit,
      projectId: ids.project,
      name: 'Auditoría inicial',
      status: 'IN_PROGRESS',
      startedAt: new Date()
    }
  });

  const assets = [
    { id: 'asset-1', name: 'web-prod-01', ip: '10.0.0.15' },
    { id: 'asset-2', name: 'db-main', ip: '192.168.1.50' },
    { id: 'asset-3', name: 'gateway', ip: '10.0.0.1' }
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { id: asset.id },
      update: { ...asset, auditId: ids.audit },
      create: { ...asset, auditId: ids.audit, type: 'host' }
    });
  }

  const rules = [
    {
      id: 'rule-ftp-port',
      name: 'Servicio FTP expuesto',
      type: 'PORT_SERVICE',
      condition: { port: 21 },
      baseRiskScore: 30,
      recommendation: 'Deshabilitar FTP anónimo y usar SFTP'
    },
    {
      id: 'rule-log4shell-cve',
      name: 'Indicador de Log4Shell',
      type: 'VULNERABILITY',
      condition: { vulnerability: 'CVE-2021-44228' },
      baseRiskScore: 100,
      recommendation: 'Actualizar Log4j a una versión corregida por el proveedor'
    }
  ];

  for (const rule of rules) {
    await prisma.knowledgeRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
