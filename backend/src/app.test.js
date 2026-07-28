import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { prisma, disconnectPrisma } from './database/prisma.js';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  viewer: '10000000-0000-4000-8000-000000000004',
  admin: '10000000-0000-4000-8000-000000000005',
  managedUser: '10000000-0000-4000-8000-000000000006',
  registeredUser: '10000000-0000-4000-8000-000000000007',
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
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ids.user, ids.viewer, ids.admin, ids.managedUser, ids.registeredUser]
        }
      }
    });
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

  test('self-registers only VIEWER accounts and limits them to dashboard data', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'self-registered@vulnmind.local',
        password: 'self-registration-password',
        role: 'ADMIN',
        active: false
      });
    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({
      email: 'self-registered@vulnmind.local',
      role: 'VIEWER',
      active: true
    });
    ids.registeredUser = registration.body.data.user.id;

    const login = await request(app).post('/api/auth/login').send({
      email: 'self-registered@vulnmind.local',
      password: 'self-registration-password'
    });
    expect(login.status).toBe(200);
    const token = login.body.data.token;

    const [dashboard, recent, projects, graph, rules, findings] = await Promise.all([
      request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/findings/recent').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/projects').set('Authorization', `Bearer ${token}`),
      request(app).get(`/api/attack-graph?auditId=${ids.audit}`).set('Authorization', `Bearer ${token}`),
      request(app).get('/api/knowledge/rules').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/findings').set('Authorization', `Bearer ${token}`)
    ]);
    expect(dashboard.status).toBe(200);
    expect(recent.status).toBe(200);
    expect(projects.status).toBe(200);
    expect(graph.status).toBe(403);
    expect(rules.status).toBe(403);
    expect(findings.status).toBe(403);

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'self-registered@vulnmind.local',
        password: 'self-registration-password'
      });
    expect(duplicate.status).toBe(409);
  });

  test('allows only administrators to manage users and invalidates disabled sessions', async () => {
    const forbidden = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'managed-integration@vulnmind.local',
        password: 'temporary-password',
        role: 'VIEWER'
      });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      email: 'managed-integration@vulnmind.local',
      role: 'VIEWER',
      active: true
    });
    const managedId = created.body.data.id;
    ids.managedUser = managedId;
    expect(created.body.data.passwordHash).toBeUndefined();

    const duplicate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'managed-integration@vulnmind.local',
        password: 'another-password',
        role: 'AUDITOR'
      });
    expect(duplicate.status).toBe(409);

    const updated = await request(app)
      .patch(`/api/users/${managedId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'AUDITOR' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.role).toBe('AUDITOR');

    const reset = await request(app)
      .post(`/api/users/${managedId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'replacement-password' });
    expect(reset.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({
      email: 'managed-integration@vulnmind.local',
      password: 'replacement-password'
    });
    expect(login.status).toBe(200);

    const disabled = await request(app)
      .patch(`/api/users/${managedId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.active).toBe(false);

    const invalidatedSession = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(invalidatedSession.status).toBe(401);
    const disabledLogin = await request(app).post('/api/auth/login').send({
      email: 'managed-integration@vulnmind.local',
      password: 'replacement-password'
    });
    expect(disabledLogin.status).toBe(401);

    const selfDisable = await request(app)
      .patch(`/api/users/${ids.admin}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(selfDisable.status).toBe(409);
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
      .set('Authorization', `Bearer ${auditorToken}`);
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

  test('imports and updates JSON knowledge rules without duplicating their codes', async () => {
    const payload = {
      filename: 'integration-rules.json',
      content: JSON.stringify({
        knowledgeRules: [{
          code: 'KB-INTEGRATION-JSON-001',
          name: 'Imported credential reuse rule',
          condition: { tagsAny: ['credential-reuse'] },
          baseRisk: 60,
          priority: 70,
          recommendation: 'Rotate the imported integration credentials',
          active: true
        }],
        correlationRules: [{ code: 'UNSUPPORTED-INTEGRATION' }]
      })
    };
    const denied = await request(app)
      .post('/api/knowledge/rules/import')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send(payload);
    expect(denied.status).toBe(403);

    const first = await request(app)
      .post('/api/knowledge/rules/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ created: 1, updated: 0, rejected: 0 });
    expect(first.body.data.warnings[0]).toContain('correlationRules');

    const second = await request(app)
      .post('/api/knowledge/rules/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...payload,
        content: JSON.stringify({
          knowledgeRules: [{
            ...JSON.parse(payload.content).knowledgeRules[0],
            baseRisk: 65
          }]
        })
      });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ created: 0, updated: 1 });
    expect(await prisma.knowledgeRule.count({
      where: { code: 'KB-INTEGRATION-JSON-001' }
    })).toBe(1);
    expect(await prisma.knowledgeRule.findUnique({
      where: { code: 'KB-INTEGRATION-JSON-001' }
    })).toMatchObject({
      type: 'TAG',
      baseRiskScore: 65
    });

    await prisma.knowledgeRule.delete({
      where: { code: 'KB-INTEGRATION-JSON-001' }
    });
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
      request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${auditorToken}`),
      request(app).get(`/api/audits/${auditId}`).set('Authorization', `Bearer ${auditorToken}`),
      request(app).get(`/api/assets/${assetId}`).set('Authorization', `Bearer ${auditorToken}`)
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
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');
  });

  test('imports JSON findings through the engine and replays the same file idempotently', async () => {
    const importBody = {
      auditId: ids.audit,
      format: 'json',
      filename: 'integration-scan.json',
      content: JSON.stringify({
        hosts: [{
          hostname: 'imported-integration-host',
          ip: '198.51.100.25',
          ports: [
            { port: 2121, service: 'integration-service' },
            { port: 443, service: 'https', vulnerability: 'CVE-2026-10001' }
          ]
        }]
      })
    };

    const first = await request(app)
      .post('/api/imports/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send(importBody);
    const replay = await request(app)
      .post('/api/imports/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send(importBody);

    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      total: 2,
      accepted: 2,
      replayed: 0,
      rejected: 0,
      assetsCreated: 1
    });
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      accepted: 0,
      replayed: 2,
      rejected: 0,
      assetsCreated: 0
    });
  });

  test('reports row errors for partial imports and rejects corrupt files', async () => {
    const partial = await request(app)
      .post('/api/imports/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        auditId: ids.audit,
        format: 'csv',
        filename: 'partial.csv',
        content: [
          'asset,ip,port,service',
          'valid-import,203.0.113.10,2121,integration-service',
          'invalid-import,203.0.113.11,99999,http'
        ].join('\n')
      });
    const corrupt = await request(app)
      .post('/api/imports/findings')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        auditId: ids.audit,
        format: 'json',
        filename: 'corrupt.json',
        content: '{not-json'
      });

    expect(partial.status).toBe(207);
    expect(partial.body.data).toMatchObject({ accepted: 1, rejected: 1 });
    expect(partial.body.data.errors[0].source).toBe(3);
    expect(corrupt.status).toBe(400);
    expect(corrupt.body.message).toBe('JSON corrupto o mal formado');
  });

  test('filters the real dashboard timeline and protects audited exports', async () => {
    const stats = await request(app)
      .get(`/api/dashboard/stats?projectId=${ids.project}&period=7d`)
      .set('Authorization', `Bearer ${viewerToken}`);
    const denied = await request(app)
      .get(`/api/exports/findings?projectId=${ids.project}&format=csv&period=7d`)
      .set('Authorization', `Bearer ${viewerToken}`);
    const exported = await request(app)
      .get(`/api/exports/findings?projectId=${ids.project}&format=csv&period=7d`)
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(stats.status).toBe(200);
    expect(stats.body.data.riskTrend).toHaveLength(7);
    expect(stats.body.data.totalFindings).toBeGreaterThan(0);
    expect(denied.status).toBe(403);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('integration-host');
    expect(await prisma.auditLog.count({
      where: { action: 'FINDINGS_EXPORTED', userId: ids.user }
    })).toBeGreaterThan(0);
  });

  test('exposes Push availability without leaking VAPID private material', async () => {
    const configuration = await request(app)
      .get('/api/notifications/configuration')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(configuration.status).toBe(200);
    expect(configuration.body.data).toMatchObject({
      enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      subscribed: false
    });
    expect(configuration.body.data.privateKey).toBeUndefined();
    if (process.env.VAPID_PRIVATE_KEY) {
      expect(JSON.stringify(configuration.body)).not.toContain(process.env.VAPID_PRIVATE_KEY);
    }
  });
});
