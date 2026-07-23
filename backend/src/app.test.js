import request from 'supertest';
import app from './app.js';
import { store } from './store/memory.js';

describe('VulnMind API prototype', () => {
  beforeEach(() => {
    store.findings.length = 0;
  });

  test('reports a healthy API', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });

  test('processes an FTP finding and exposes its real engine result', async () => {
    const response = await request(app)
      .post('/api/findings')
      .send({
        assetId: 'asset-1',
        rawData: { assetName: 'web-prod-01', port: 21 }
      });

    expect(response.status).toBe(202);
    expect(response.body.data.riskScore).toBe(30);
    expect(response.body.data.recommendations).toContain(
      'Deshabilitar FTP anónimo y usar SFTP'
    );
  });

  test('rejects malformed findings', async () => {
    const response = await request(app)
      .post('/api/findings')
      .send({ assetId: '', rawData: {} });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation Error');
  });
});
