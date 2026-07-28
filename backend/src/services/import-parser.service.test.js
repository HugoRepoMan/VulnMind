import {
  parseCsvImport,
  parseJsonImport,
  parseNmapImport
} from './import-parser.service.js';

describe('import parser', () => {
  test('normalizes quoted CSV records and reports invalid rows', () => {
    const records = parseCsvImport([
      'asset,ip,port,service,version,vulnerability,evidence',
      '"web, principal",10.0.0.5,443,https,nginx 1.25,CVE-2024-0001,"TLS, scan"',
      'broken,10.0.0.6,99999,http,,,'
    ].join('\n'));

    expect(records[0]).toMatchObject({
      sourceIndex: 2,
      asset: { name: 'web, principal', ip: '10.0.0.5' },
      rawData: {
        port: 443,
        service: 'https',
        vulnerability: 'CVE-2024-0001',
        evidence: 'TLS, scan'
      }
    });
    expect(records[1].error).toContain('Puerto inválido');
  });

  test('flattens JSON hosts with multiple ports', () => {
    const records = parseJsonImport(JSON.stringify({
      hosts: [{
        hostname: 'database',
        ip: '10.0.0.8',
        os: 'Linux',
        ports: [
          { port: 5432, service: 'postgresql' },
          { port: 22, service: 'ssh' }
        ]
      }]
    }));

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      asset: { name: 'database', ip: '10.0.0.8' },
      rawData: { port: 5432, os: 'Linux', service: 'postgresql' }
    });
  });

  test('preserves explicit attack-path evidence from JSON imports', () => {
    const [record] = parseJsonImport(JSON.stringify({
      asset: 'web-prod',
      ip: '203.0.113.10',
      port: 80,
      service: 'http',
      vulnerability: 'CVE-2026-0001',
      evidence: 'Credential reuse confirmed by the scanner',
      username: 'service-admin',
      privilege: 'database-writer',
      targetAsset: 'db-main',
      exposure: 'external'
    }));

    expect(record.rawData).toMatchObject({
      username: 'service-admin',
      privilege: 'database-writer',
      targetAsset: 'db-main',
      exposure: 'external'
    });
  });

  test('extracts open Nmap ports, product data and CVEs', () => {
    const records = parseNmapImport(`
      <?xml version="1.0"?>
      <nmaprun>
        <host>
          <status state="up"/>
          <address addr="192.0.2.10" addrtype="ipv4"/>
          <hostnames><hostname name="gateway.local"/></hostnames>
          <os><osmatch name="Linux 6.x"/></os>
          <ports>
            <port protocol="tcp" portid="443">
              <state state="open"/>
              <service name="https" product="nginx" version="1.24"/>
              <script id="vulners" output="Detected CVE-2025-12345"/>
            </port>
            <port protocol="tcp" portid="80"><state state="closed"/></port>
          </ports>
        </host>
      </nmaprun>
    `);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      asset: { name: 'gateway.local', ip: '192.0.2.10' },
      rawData: {
        port: 443,
        service: 'https',
        version: 'nginx 1.24',
        vulnerability: 'CVE-2025-12345'
      }
    });
  });

  test('rejects custom XML entities', () => {
    expect(() => parseNmapImport('<!DOCTYPE a [<!ENTITY x "bad">]><nmaprun/>'))
      .toThrow('entidades personalizadas');
  });
});
