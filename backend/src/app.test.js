import request from 'supertest';
import app from './app.js';
import { prisma, disconnectPrisma } from './database/prisma.js';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  project: '10000000-0000-4000-8000-000000000002',
  audit: '10000000-0000-4000-8000-000000000003',
  asset: 'integration-asset',
  rule: 'integration-rule-port-2121'
};

describe('VulnMind PostgreSQL API integration', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: ids.user },
      update: {},
      create: {
        id: ids.user,
        email: 'integration@vulnmind.local',
        passwordHash: 'not-used-in-phase-2',
        role: 'AUDITOR'
      }
    });
    await prisma.project.upsert({
      where: { id: ids.project },
      update: {},
      create: { id: ids.project, ownerId: ids.user, name: 'Integration project' }
    });
    await prisma.audit.upsert({
      where: { id: ids.audit },
      update: {},
      create: {
        id: ids.audit,
        projectId: ids.project,
        name: 'Integration audit',
        status: 'IN_PROGRESS'
      }
    });
    await prisma.asset.upsert({
      where: { id: ids.asset },
      update: { riskScore: 0 },
      create: {
        id: ids.asset,
        auditId: ids.audit,
        name: 'integration-host',
        type: 'host'
      }
    });
    await prisma.knowledgeRule.upsert({
      where: { id: ids.rule },
      update: {},
      create: {
        id: ids.rule,
        name: 'Integration-only port rule',
        type: 'PORT_SERVICE',
        condition: { port: 2121 },
        baseRiskScore: 55,
        recommendation: 'Cerrar el servicio de prueba'
      }
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: ids.project } });
    await prisma.knowledgeRule.deleteMany({ where: { id: ids.rule } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await disconnectPrisma();
  });

  test('reports a healthy API', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });

  test('persists a finding, its analysis, risk and audit log', async () => {
    const response = await request(app)
      .post('/api/findings')
      .send({
        assetId: ids.asset,
        rawData: {
          assetName: 'integration-host',
          port: 2121,
          service: 'integration-service'
        }
      });

    expect(response.status).toBe(202);
    expect(response.body.data.riskScore).toBe(55);
    expect(response.body.data.recommendations).toContain(
      'Cerrar el servicio de prueba'
    );
    expect(response.body.data.explanation).toContain('55');

    const persisted = await prisma.finding.findUnique({
      where: { id: response.body.data.id },
      include: { analysis: { include: { rules: true } }, asset: true }
    });
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: response.body.data.id }
    });

    expect(persisted.analysis.calculatedRisk).toBe(55);
    expect(persisted.analysis.rules.map(({ id }) => id)).toContain(ids.rule);
    expect(persisted.asset.riskScore).toBe(55);
    expect(auditLog.action).toBe('FINDING_PROCESSED');
  });

  test('reads dashboard metrics and recent findings from PostgreSQL', async () => {
    const [statsResponse, recentResponse] = await Promise.all([
      request(app).get('/api/dashboard/stats'),
      request(app).get('/api/findings/recent')
    ]);

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.data.totalAssets).toBeGreaterThanOrEqual(1);
    expect(statsResponse.body.data.rulesMatched).toBeGreaterThanOrEqual(1);
    expect(recentResponse.status).toBe(200);
    expect(recentResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: ids.asset,
          riskScore: 55,
          severity: 'High'
        })
      ])
    );
  });

  test('rejects malformed findings without persisting them', async () => {
    const countBefore = await prisma.finding.count({ where: { assetId: ids.asset } });
    const response = await request(app)
      .post('/api/findings')
      .send({ assetId: '', rawData: {} });
    const countAfter = await prisma.finding.count({ where: { assetId: ids.asset } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation Error');
    expect(countAfter).toBe(countBefore);
  });
});
