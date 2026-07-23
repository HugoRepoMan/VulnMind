import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  project: '00000000-0000-4000-8000-000000000002',
  audit: '00000000-0000-4000-8000-000000000003'
};

async function main() {
  const passwordHash = await bcrypt.hash('vulnmind-dev-only', 12);

  await prisma.user.upsert({
    where: { email: 'admin@vulnmind.local' },
    update: { role: 'ADMIN' },
    create: {
      id: ids.user,
      email: 'admin@vulnmind.local',
      passwordHash,
      role: 'ADMIN'
    }
  });

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
