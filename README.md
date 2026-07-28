# VulnMind

VulnMind es una PWA para auditorías de ciberseguridad. Gestiona proyectos,
auditorías y activos; procesa hallazgos con reglas persistentes; calcula riesgo,
correlación y recomendaciones; y conserva una explicación completa de cada
decisión.

## Funcionalidad

- Autenticación JWT y roles `ADMIN`, `AUDITOR` y `VIEWER`.
- CRUD operativo y base de conocimiento en PostgreSQL.
- Motor idempotente y explicable con historial, MITRE, OWASP y CWE.
- Importación Nmap XML, CSV y JSON con errores por registro.
- Comparación entre dos escaneos reales del mismo activo: hallazgos nuevos,
  persistentes, corregidos y reabiertos; cambios de puertos, servicios, versiones
  y riesgo.
- Grafo explicable de rutas potenciales construido desde activos, servicios,
  vulnerabilidades, identidades, evidencia y correlaciones persistidas.
- Motor de priorización de remediaciones con reducción marginal de riesgo,
  criticidad de activos, exposición, rutas afectadas, esfuerzo y dependencias.
- Borradores y cola offline en IndexedDB con reintentos y conflictos.
- Notificaciones Web Push para hallazgos críticos.
- Dashboard real con filtros de proyecto, auditoría, activo y 7/30/90 días.
- Exportaciones CSV y JSON protegidas por rol y registradas en auditoría.
- PWA responsive, navegación móvil, carga diferida y service worker.

## Inicio rápido con Docker

1. Copia `.env.example` como `.env`.
2. Sustituye `JWT_SECRET` por un valor largo y aleatorio.
3. Opcionalmente genera claves Push:

   ```bash
   cd backend
   npm ci
   npm run vapid:generate
   ```

4. Copia las claves a `.env` y ejecuta:

   ```bash
   docker compose up --build
   ```

Servicios locales:

- PWA: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

El backend aplica migraciones y el seed idempotente al iniciar. La cuenta local
de demostración es `admin@vulnmind.local` / `vulnmind-dev-only`; no debe usarse
en producción.

Si el puerto 3000 está reservado, cambia `BACKEND_PORT` en `.env`; el frontend
recibe automáticamente la URL correspondiente.

Para detener sin borrar los datos:

```bash
docker compose down
```

## Importaciones

Desde **Auditorías → Importar hallazgos** se aceptan archivos de hasta 5 MB y
1.000 registros.

CSV admite estas columnas (también sus alias en español):

```csv
asset,ip,port,service,version,vulnerability,evidence
gateway,192.0.2.10,443,https,nginx 1.24,CVE-2025-12345,TLS scan
```

JSON puede ser una lista de hallazgos o una colección de hosts:

```json
{
  "hosts": [
    {
      "hostname": "gateway",
      "ip": "192.0.2.10",
      "os": "Linux",
      "ports": [
        { "port": 443, "service": "https", "vulnerability": "CVE-2025-12345" }
      ]
    }
  ]
}
```

Para enriquecer el grafo de rutas, CSV y JSON también admiten señales opcionales
como `evidence`, `username`, `privilege`, `credentials`, `targetAsset`,
`connectedTo` y `exposure`. El nodo **Internet** sólo aparece cuando el registro
indica alcance externo o el activo usa una IP pública.

La criticidad de un activo (`LOW`, `MEDIUM`, `HIGH` o `CRITICAL`) puede definirse
al crearlo o mediante el campo `criticality` de una importación. Las reglas de la
base de conocimiento permiten registrar `remediationEffort` y `dependencies`.
La pantalla **Remediaciones** calcula el impacto marginal con esos valores y
expone la fórmula completa utilizada para ordenar las acciones.

## Importación de reglas JSON

Los administradores pueden importar reglas desde **Conocimiento → Importar
reglas JSON**. Se admite una lista directa o un objeto con `rules` o
`knowledgeRules`. `baseRisk` se acepta como alias de `baseRiskScore`, el tipo se
infiere cuando no está presente y `code` se usa para actualizar una regla
existente sin duplicarla. Las condiciones `tagsAny` y `tagsAll` se evalúan
contra las etiquetas persistidas del hallazgo.

```json
{
  "knowledgeRules": [
    {
      "code": "KB-FTP-001",
      "name": "Servicio FTP expuesto",
      "condition": { "port": 21 },
      "baseRisk": 30,
      "priority": 40,
      "recommendation": "Deshabilitar FTP y utilizar SFTP.",
      "active": true
    }
  ]
}
```

Las secciones con otros modelos, como `correlationRules`, no se importan como
reglas de conocimiento y aparecen explícitamente como advertencias.

La reimportación del mismo contenido conserva claves deterministas y recupera
los hallazgos existentes. Nmap XML sólo importa hosts activos y puertos abiertos;
las entidades XML personalizadas se rechazan.

Para comparar escaneos, crea dos auditorías dentro del mismo proyecto e importa
en cada una la captura correspondiente. En **Auditorías → Comparación inteligente
entre escaneos**, selecciona la auditoría y el activo inicial, y después la
auditoría y el activo posterior. El análisis se calcula bajo demanda a partir de
los hallazgos guardados en PostgreSQL.

## Desarrollo y verificación

Backend:

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm run build
npm test
```

Las pruebas integrales requieren PostgreSQL local y aplican la URL de desarrollo
por defecto. En Windows y Unix el mismo comando `npm test` funciona.

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

La imagen final del frontend usa Nginx y reenvía `/api` al servicio `backend`.
Docker Compose selecciona la etapa `development` para conservar recarga en vivo.

## Capturas y demostración

![Dashboard SOC](docs/screenshots/dashboard.png)

![Explicabilidad de un hallazgo](docs/screenshots/finding-explainability.png)

![Importación de auditorías](docs/screenshots/audits-import.png)

![Configuración offline y Push](docs/screenshots/settings-sync-push.png)

![Dashboard móvil](docs/screenshots/dashboard-mobile.png)

La secuencia completa para presentar el proyecto está en
[docs/DEMO.md](docs/DEMO.md).

## Seguridad operativa

- Nunca confirmes `.env`, secretos JWT, claves VAPID ni credenciales reales.
- Sólo `ADMIN`/`AUDITOR` pueden importar o exportar; `VIEWER` es de lectura.
- Las exportaciones neutralizan celdas que podrían ejecutar fórmulas.
- Las suscripciones Push inválidas (`404/410`) se eliminan automáticamente.
- `Idempotency-Key` debe conservarse en todos los reintentos.

Consulta [ESTADO_DEL_PROYECTO.md](./ESTADO_DEL_PROYECTO.md) para el inventario
completo de etapas, API, arquitectura y verificaciones.
