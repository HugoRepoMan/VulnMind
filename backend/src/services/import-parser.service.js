const MAX_RECORDS = 1000;

const decodeXml = (value = '') => value
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');

const xmlAttributes = (tag = '') => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1], decodeXml(match[2] ?? match[3] ?? '')])
);

const optionalText = (value) => {
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized || null;
};

const optionalPort = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Puerto inválido: ${value}`);
  }
  return port;
};

const makeRecord = ({ name, ip, type = 'host', port, os, service, version, vulnerability, evidence }) => {
  const assetName = optionalText(name) || optionalText(ip);
  if (!assetName) throw new Error('El registro no contiene nombre de activo ni dirección IP');

  const rawData = {
    port: optionalPort(port),
    os: optionalText(os),
    service: optionalText(service),
    version: optionalText(version),
    vulnerability: optionalText(vulnerability),
    ...(optionalText(evidence) ? { evidence: optionalText(evidence) } : {})
  };

  if (!rawData.port && !rawData.service && !rawData.vulnerability) {
    throw new Error('El registro no contiene puerto, servicio ni vulnerabilidad');
  }

  return {
    asset: {
      name: assetName.slice(0, 120),
      ip: optionalText(ip)?.slice(0, 255) ?? null,
      type: optionalText(type)?.slice(0, 80) ?? 'host'
    },
    rawData
  };
};

const parseCsvRows = (content) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('CSV corrupto: comillas sin cerrar');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const normalizeHeader = (value) => value.trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\s_-]+/g, '');

const field = (row, aliases) => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && String(row[alias]).trim()) return row[alias];
  }
  return null;
};

export const parseCsvImport = (content) => {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV vacío o sin filas de datos');

  const headers = rows[0].map(normalizeHeader);
  const requiredSignals = ['port', 'puerto', 'service', 'servicio', 'vulnerability', 'vulnerabilidad', 'cve'];
  if (!headers.some((header) => requiredSignals.includes(header))) {
    throw new Error('CSV inválido: falta una columna de puerto, servicio o vulnerabilidad');
  }

  return rows.slice(1).map((values, index) => {
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
    try {
      return {
        sourceIndex: index + 2,
        ...makeRecord({
          name: field(row, ['asset', 'activo', 'host', 'hostname', 'name', 'nombre']),
          ip: field(row, ['ip', 'address', 'direccion']),
          type: field(row, ['type', 'tipo']) || 'host',
          port: field(row, ['port', 'puerto']),
          os: field(row, ['os', 'sistemaoperativo']),
          service: field(row, ['service', 'servicio']),
          version: field(row, ['version']),
          vulnerability: field(row, ['vulnerability', 'vulnerabilidad', 'cve']),
          evidence: field(row, ['evidence', 'evidencia'])
        })
      };
    } catch (error) {
      return { sourceIndex: index + 2, error: error.message };
    }
  });
};

export const parseNmapImport = (content) => {
  if (!/<nmaprun\b/i.test(content)) throw new Error('XML inválido: no es una salida de Nmap');
  if (/<!ENTITY\b/i.test(content)) {
    throw new Error('XML rechazado: no se permiten entidades personalizadas');
  }

  const records = [];
  const hosts = [...content.matchAll(/<host\b[^>]*>([\s\S]*?)<\/host>/gi)];
  hosts.forEach((hostMatch, hostIndex) => {
    const hostXml = hostMatch[1];
    const statusTag = hostXml.match(/<status\b[^>]*>/i)?.[0];
    if (statusTag && xmlAttributes(statusTag).state === 'down') return;

    const addressTags = [...hostXml.matchAll(/<address\b[^>]*>/gi)].map((match) => xmlAttributes(match[0]));
    const ip = addressTags.find(({ addrtype }) => ['ipv4', 'ipv6'].includes(addrtype))?.addr
      || addressTags[0]?.addr;
    const hostnameTag = hostXml.match(/<hostname\b[^>]*>/i)?.[0];
    const hostname = hostnameTag ? xmlAttributes(hostnameTag).name : null;
    const osTag = hostXml.match(/<osmatch\b[^>]*>/i)?.[0];
    const os = osTag ? xmlAttributes(osTag).name : null;
    const ports = [...hostXml.matchAll(/<port\b([^>]*)>([\s\S]*?)<\/port>/gi)];

    ports.forEach((portMatch, portIndex) => {
      const portAttributes = xmlAttributes(portMatch[1]);
      const body = portMatch[2];
      const stateTag = body.match(/<state\b[^>]*>/i)?.[0];
      if (stateTag && xmlAttributes(stateTag).state !== 'open') return;
      const serviceTag = body.match(/<service\b[^>]*>/i)?.[0];
      const service = serviceTag ? xmlAttributes(serviceTag) : {};
      const scriptTags = [...body.matchAll(/<script\b[^>]*>/gi)].map((match) => xmlAttributes(match[0]));
      const scriptEvidence = scriptTags.map(({ id, output }) => [id, output].filter(Boolean).join(': ')).join(' | ');
      const cve = scriptEvidence.match(/\bCVE-\d{4}-\d{4,}\b/i)?.[0]?.toUpperCase();
      const version = [service.product, service.version, service.extrainfo].filter(Boolean).join(' ');

      try {
        records.push({
          sourceIndex: `${hostIndex + 1}.${portIndex + 1}`,
          ...makeRecord({
            name: hostname || ip,
            ip,
            port: portAttributes.portid,
            os,
            service: service.name || service.product,
            version,
            vulnerability: cve,
            evidence: scriptEvidence
          })
        });
      } catch (error) {
        records.push({
          sourceIndex: `${hostIndex + 1}.${portIndex + 1}`,
          error: error.message
        });
      }
    });
  });

  if (!hosts.length) throw new Error('XML Nmap sin hosts');
  if (!records.length) throw new Error('XML Nmap sin puertos abiertos importables');
  return records;
};

const flattenJson = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.findings)) return parsed.findings;
  if (Array.isArray(parsed.hosts)) {
    return parsed.hosts.flatMap((host) => {
      if (!Array.isArray(host.ports)) return [host];
      return host.ports.map((port) => ({
        ...port,
        asset: host.asset || host.name || host.hostname,
        hostname: host.hostname,
        ip: host.ip || host.address,
        os: port.os || host.os,
        type: host.type
      }));
    });
  }
  return [parsed];
};

export const parseJsonImport = (content) => {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('JSON corrupto o mal formado');
  }

  const rows = flattenJson(parsed);
  if (!rows.length) throw new Error('JSON sin registros');

  return rows.map((row, index) => {
    try {
      const raw = row.rawData || row.finding || row;
      const asset = typeof row.asset === 'object' ? row.asset : {};
      return {
        sourceIndex: index + 1,
        ...makeRecord({
          name: asset.name || row.assetName || row.asset || row.host || row.hostname || row.name,
          ip: asset.ip || row.ip || row.address,
          type: asset.type || row.type || 'host',
          port: raw.port,
          os: raw.os || row.os,
          service: raw.service,
          version: raw.version,
          vulnerability: raw.vulnerability || raw.cve,
          evidence: raw.evidence
        })
      };
    } catch (error) {
      return { sourceIndex: index + 1, error: error.message };
    }
  });
};

export const parseImport = (format, content) => {
  const parsers = {
    csv: parseCsvImport,
    json: parseJsonImport,
    nmap: parseNmapImport
  };
  const records = parsers[format](content);
  if (records.length > MAX_RECORDS) {
    throw new Error(`El archivo supera el límite de ${MAX_RECORDS} registros`);
  }
  return records;
};
