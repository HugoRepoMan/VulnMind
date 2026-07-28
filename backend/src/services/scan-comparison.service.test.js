import { compareAssetScans } from './scan-comparison.service.js';

const finding = ({
  id, port, service, version, vulnerability = null,
  status = 'OPEN', riskScore = 0
}) => ({
  id,
  port,
  vulnerability,
  status,
  severity: riskScore >= 40 ? 'HIGH' : 'MEDIUM',
  riskScore,
  rawData: { port, service, version, vulnerability },
  analysis: { inferredService: service, inferredVersion: version }
});

const asset = ({ id, auditName, riskScore, findings }) => ({
  id,
  name: 'gateway',
  ip: '192.0.2.10',
  riskScore,
  audit: { id: `audit-${id}`, name: auditName, projectId: 'project-1' },
  findings
});

describe('scan comparison service', () => {
  test('classifies real differences between two persisted asset snapshots', () => {
    const baseline = asset({
      id: 'baseline',
      auditName: 'Escaneo inicial',
      riskScore: 55,
      findings: [
        finding({ id: 'ftp-old', port: 21, service: 'ftp', version: '1.0', vulnerability: 'CVE-FTP', riskScore: 55 }),
        finding({ id: 'http-old', port: 80, service: 'http', version: 'nginx 1.24', riskScore: 30 }),
        finding({ id: 'tls-old', port: 443, service: 'https', version: '1.2', vulnerability: 'CVE-TLS', status: 'RESOLVED', riskScore: 40 })
      ]
    });
    const current = asset({
      id: 'current',
      auditName: 'Escaneo posterior',
      riskScore: 40,
      findings: [
        finding({ id: 'http-new', port: 80, service: 'http', version: 'nginx 1.26', riskScore: 25 }),
        finding({ id: 'ssh-new', port: 22, service: 'ssh', version: '9.9', riskScore: 35 }),
        finding({ id: 'tls-new', port: 443, service: 'https', version: '1.2', vulnerability: 'CVE-TLS', status: 'OPEN', riskScore: 40 })
      ]
    });

    const result = compareAssetScans(baseline, current);

    expect(result.summary).toMatchObject({
      newFindings: 1,
      persistentFindings: 1,
      correctedFindings: 1,
      reopenedFindings: 1,
      newPorts: 1,
      removedPorts: 1,
      removedServices: 1,
      versionChanges: 1,
      riskDelta: -15,
      riskTrend: 'DECREASED'
    });
    expect(result.changes.correctedFindings[0]).toMatchObject({ port: 21, service: 'ftp' });
    expect(result.changes.newPorts[0]).toMatchObject({ port: 22, service: 'ssh' });
    expect(result.changes.versionChanges[0]).toMatchObject({
      port: 80,
      before: 'nginx 1.24',
      after: 'nginx 1.26'
    });
  });
});
