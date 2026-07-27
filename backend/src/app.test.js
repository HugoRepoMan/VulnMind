import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { prisma, disconnectPrisma } from './database/prisma.js';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  viewer: '10000000-0000-4000-8000-000000000004',
  admin: '10000000-0000-4000-8000-000000000005',
  project: '10000000-0000-4000-8000-000000000002',
  audit: '10000000-0000-4000-8000-000000000003',
  asset: 'integration-asset',
  rule: 'integration-rule-port-2121'
};

describe('VulnMind PostgreSQL API integration', () => {
  let auditorToken;
  let viewerToken;
  let adminToken;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('integration-password', 10);
    await prisma.user.upsert({
      where: { id: ids.user },
      update: { passwordHash },
      create: {
        id: ids.user,
        email: 'integration@vulnmind.local',
        passwordHash,
        role: 'AUDITOR'
      }
    });
    await prisma.user.upsert({
      where: { id: ids.admin },
      update: { passwordHash },
      create: {
        id: ids.admin,
        email: 'admin-integration@vulnmind.local',
        passwordHash,
        role: 'ADMIN'
      }
    });
    await prisma.user.upsert({
      where: { id: ids.viewer },
      update: { passwordHash },
      create: {
        id: ids.viewer,
        email: 'viewer-integration@vulnmind.local',
        passwordHash,
        role: 'VIEWER'
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

    const [auditorLogin, viewerLogin, adminLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({
        email: 'integration@vulnmind.local',
        password: 'integration-password'
      }),
      request(app).post('/api/auth/login').send({
        email: 'viewer-integration@vulnmind.local',
        password: 'integration-password'
      }),
      request(app).post('/api/auth/login').send({
        email: 'admin-integration@vulnmind.local',
        password: 'integration-password'
      })
    ]);
    auditorToken = auditorLogin.body.data.token;
    viewerToken = viewerLogin.body.data.token;
    adminToken = adminLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: ids.project } });
    await prisma.knowledgeRule.deleteMany({ where: { id: ids.rule } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.user, ids.viewer, ids.admin] } } });
    await disconnectPrisma();
  });

  test('reports a healthy API', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });

  test('authenticates a valid user and restores its session', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      email: 'integration@vulnmind.local',
      role: 'AUDITOR'
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects protected requests without a token', async () => {
    const response = await request(app).get('/api/dashboard/stats');

    expect(response.status).toBe(401);
  });

  test('prevents a viewer from creating findings', async () => {
    const response = await request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ assetId: ids.asset, rawData: { port: 2121 } });

    expect(response.status).toBe(403);
  });

  test('persists a finding, its analysis, risk and audit log', async () => {
    const response = await request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
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
    expect(auditLog.userId).toBe(ids.user);
  });

  test('reads dashboard metrics and recent findings from PostgreSQL', async () => {
    const [statsResponse, recentResponse] = await Promise.all([
      request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${viewerToken}`),
      request(app)
        .get('/api/findings/recent')
        .set('Authorization', `Bearer ${viewerToken}`)
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
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ assetId: '', rawData: {} });
    const countAfter = await prisma.finding.count({ where: { assetId: ids.asset } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation Error');
    expect(countAfter).toBe(countBefore);
  });

  test('processes findings idempotently and persists an explainable engine trace', async () => {
    const payload = {
      assetId: ids.asset,
      rawData: {
        port: 2121,
        service: 'integration-service',
        vulnerability: 'CVE-INTEGRATION-0001'
      }
    };
    const key = 'integration-idempotency-engine-0001';
    const countBefore = await prisma.finding.count({ where: { assetId: ids.asset } });

    const first = await request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('Idempotency-Key', key)
      .send(payload);
    const replay = await request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('Idempotency-Key', key)
      .send(payload);
    const countAfter = await prisma.finding.count({ where: { assetId: ids.asset } });

    expect(first.status).toBe(202);
    expect(first.body.idempotentReplay).toBe(false);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(countAfter).toBe(countBefore + 1);
    expect(first.body.data.analysis).toMatchObject({
      engineVersion: '2.0',
      calculatedRisk: 55,
      riskBreakdown: {
        finalScore: 55,
        method: 'SUM_ACTIVE_RULES_CAPPED_0_100'
      }
    });
    expect(first.body.data.analysis.riskBreakdown.contributions[0]).toMatchObject({
      ruleId: ids.rule,
      score: 55
    });
    expect(first.body.data.analysis.timelineEvents.map(({ step }) => step)).toEqual([
      'INFERENCE_COMPLETED',
      'RULES_MATCHED',
      'RISK_CALCULATED',
      'CORRELATION_COMPLETED',
      'EXPLANATION_GENERATED'
    ]);
    expect(first.body.data.explanation).toContain('Integration-only port rule aportó 55 puntos');

    const conflict = await request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('Idempotency-Key', key)
      .send({ ...payload, rawData: { ...payload.rawData, port: 4242 } });
    expect(conflict.status).toBe(409);
  });

  test('deduplicates concurrent requests with the same idempotency key', async () => {
    const key = 'integration-concurrent-engine-0001';
    const payload = {
      assetId: ids.asset,
      rawData: { port: 2121, service: 'concurrent-integration-service' }
    };
    const countBefore = await prisma.finding.count({ where: { assetId: ids.asset } });
    const sendRequest = () => request(app)
      .post('/api/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    const responses = await Promise.all([sendRequest(), sendRequest()]);
    const countAfter = await prisma.finding.count({ where: { assetId: ids.asset } });

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 202]);
    expect(new Set(responses.map(({ body }) => body.data.id)).size).toBe(1);
    expect(countAfter).toBe(countBefore + 1);
  });

  test('administers persistent knowledge rules with validation, RBAC and audit logs', async () => {
    const denied = await request(app)
      .post('/api/knowledge/rules')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        name: 'Unauthorized rule',
        type: 'PORT_SERVICE',
        condition: { port: 9999 },
        baseRiskScore: 10,
        recommendation: 'Do not create this rule'
      });
    expect(denied.status).toBe(403);

    const invalid = await request(app)
      .post('/api/knowledge/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid risk rule',
        type: 'PORT_SERVICE',
        condition: {},
        baseRiskScore: 101,
        recommendation: 'Invalid test recommendation'
      });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/knowledge/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Administrative integration rule',
        type: 'PORT_SERVICE',
        condition: { port: 4242 },
        baseRiskScore: 42,
        recommendation: 'Restrict access to the integration service',
        mitreIds: ['T1046'],
        priority: 25
      });
    expect(created.status).toBe(201);
    const ruleId = created.body.data.id;

    const updated = await request(app)
      .patch(`/api/knowledge/rules/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false, baseRiskScore: 48 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ active: false, baseRiskScore: 48 });

    const listed = await request(app)
      .get('/api/knowledge/rules?active=false&search=Administrative')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.map(({ id }) => id)).toContain(ruleId);

    const removed = await request(app)
      .delete(`/api/knowledge/rules/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(removed.status).toBe(200);
    expect(await prisma.knowledgeRule.findUnique({ where: { id: ruleId } })).toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: { entityId: ruleId },
      orderBy: { createdAt: 'asc' }
    });
    expect(logs.map(({ action }) => action)).toEqual([
      'KNOWLEDGE_RULE_CREATED',
      'KNOWLEDGE_RULE_UPDATED',
      'KNOWLEDGE_RULE_DELETED'
    ]);
    expect(logs.every(({ userId }) => userId === ids.admin)).toBe(true);
  });

  test('manages the complete project, audit and asset relationship through the API', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ name: 'Phase 4 project', description: 'CRUD integration' });

    expect(projectResponse.status).toBe(201);
    expect(projectResponse.body.data.owner.email).toBe('integration@vulnmind.local');
    const projectId = projectResponse.body.data.id;

    const auditResponse = await request(app)
      .post(`/api/projects/${projectId}/audits`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ name: 'Phase 4 audit', status: 'IN_PROGRESS' });

    expect(auditResponse.status).toBe(201);
    const auditId = auditResponse.body.data.id;

    const assetResponse = await request(app)
      .post(`/api/audits/${auditId}/assets`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ name: 'phase-4-host', ip: '10.40.0.1', type: 'server' });

    expect(assetResponse.status).toBe(201);
    const assetId = assetResponse.body.data.id;

    const [projectDetail, auditDetail, assetDetail] = await Promise.all([
      request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${viewerToken}`),
      request(app).get(`/api/audits/${auditId}`).set('Authorization', `Bearer ${viewerToken}`),
      request(app).get(`/api/assets/${assetId}`).set('Authorization', `Bearer ${viewerToken}`)
    ]);

    expect(projectDetail.body.data.audits).toHaveLength(1);
    expect(auditDetail.body.data.assets).toHaveLength(1);
    expect(assetDetail.body.data.audit.projectId).toBe(projectId);

    const updateResponse = await request(app)
      .patch(`/api/assets/${assetId}`)
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ status: 'INACTIVE' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe('INACTIVE');

    const logs = await prisma.auditLog.findMany({ where: { projectId } });
    expect(logs.map(({ action }) => action)).toEqual(expect.arrayContaining([
      'PROJECT_CREATED', 'AUDIT_CREATED', 'ASSET_CREATED', 'ASSET_UPDATED'
    ]));

    const viewerDelete = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDelete.status).toBe(200);
    expect(await prisma.project.findUnique({ where: { id: projectId } })).toBeNull();
  });

  test('validates operational payloads and returns missing relations as 404', async () => {
    const invalid = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ name: '' });
    const missing = await request(app)
      .get('/api/assets/missing-asset')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');
  });
});
