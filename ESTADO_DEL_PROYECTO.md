# VulnMind: estado, funcionamiento y trabajo pendiente

Última actualización: 27 de julio de 2026

Rama principal: `main`

Último avance funcional: motor inteligente persistente, idempotente y explicable.

Este documento sirve como guía de relevo para entender qué funciona hoy, cómo
está organizado el sistema, cómo probarlo y qué falta por implementar. El detalle
cronológico de cada entrega se conserva en `docs/PROGRESS.md`.

## Resumen ejecutivo

VulnMind ya no usa almacenamiento en memoria para su funcionamiento real. Es una
aplicación web con React, Express y PostgreSQL que permite:

- iniciar sesión con JWT y aplicar permisos por rol;
- gestionar proyectos, auditorías y activos;
- registrar hallazgos manuales sobre activos reales;
- procesarlos con reglas persistentes de conocimiento;
- guardar el análisis, riesgo, recomendaciones, correlación y explicación;
- evitar duplicados cuando una solicitud se reintenta;
- consultar métricas reales y hallazgos recientes;
- administrar las reglas de conocimiento desde la interfaz.

Las etapas 1 a 12 están terminadas. El sistema incorpora importación de archivos,
operación offline, notificaciones, visualizaciones reales, exportaciones y un
cierre de calidad reproducible en CI y Docker.

## Estado por etapa

| Etapa | Estado | Resultado principal |
| --- | --- | --- |
| 1. Estabilización | Completada | Dependencias, validaciones, pruebas, Dockerfiles y builds corregidos. |
| 2. PostgreSQL y Prisma | Completada | Persistencia real, migraciones, seed y transacciones. |
| 3. Autenticación y roles | Completada | Login JWT, sesión, RBAC y auditoría de accesos. |
| 4. CRUD operativo | Completada | Proyectos, auditorías, activos y hallazgos con relaciones reales. |
| 5. Base de conocimiento | Completada | CRUD de reglas, filtros, administración y trazabilidad. |
| 6. Motor inteligente | Completada | Idempotencia, correlación, desglose de riesgo y explicabilidad persistente. |
| 7. Importadores | Completada | Nmap XML, CSV y JSON normalizados, validados e idempotentes. |
| 8. Offline y sincronización | Completada | Borradores, cola IndexedDB, reintentos y conflictos. |
| 9. Notificaciones Push | Completada | VAPID, suscripciones por usuario y alertas críticas. |
| 10. Dashboard final | Completada | Serie temporal, filtros y explicación visual reales. |
| 11. Exportaciones | Completada | CSV/JSON filtrados, RBAC y trazabilidad. |
| 12. Cierre | Completada | Cobertura, CI/CD, Docker, móvil y documentación. |

## Arquitectura actual

### Backend

- Node.js y Express 5.
- Prisma 7 con adaptador PostgreSQL.
- Zod para validación.
- JWT de 8 horas y bcrypt para contraseñas.
- Jest y Supertest para pruebas de integración.
- Código separado en controladores, repositorios, middlewares, servicios y
  módulos del motor inteligente.

### Frontend

- React 19 y Vite.
- React Router para rutas protegidas.
- TanStack Query para datos del servidor.
- Zustand para sesión persistida.
- Axios con interceptor Bearer y cierre de sesión ante respuestas `401`.
- Tailwind CSS, componentes shadcn/ui, Lucide y Recharts.
- Service worker PWA, borradores y cola Dexie con sincronización automática,
  espera exponencial y resolución explícita de conflictos.

### Base de datos

Prisma usa dos esquemas PostgreSQL:

- `public`: `User`, `Project`, `Audit`, `Asset`, `Finding` y `AuditLog`.
- `knowledge`: `KnowledgeRule` y `FindingAnalysis`.

La jerarquía operativa es:

```text
Usuario
└── Proyecto
    └── Auditoría
        └── Activo
            └── Hallazgo
                └── Análisis inteligente
```

Las reglas de conocimiento se relacionan con los análisis que las utilizaron.
Las eliminaciones operativas respetan cascadas y el riesgo del activo se
recalcula cuando se elimina un hallazgo.

## Cómo funciona el sistema

### 1. Autenticación

El usuario inicia sesión en `/login`. El backend valida el hash de la contraseña,
entrega un JWT y registra `LOGIN_SUCCESS` en `AuditLog`. El frontend conserva la
sesión y agrega el token a las solicitudes.

Roles:

| Acción | ADMIN | AUDITOR | VIEWER |
| --- | :---: | :---: | :---: |
| Consultar dashboard, operaciones y reglas | Sí | Sí | Sí |
| Crear o editar proyectos, auditorías, activos y hallazgos | Sí | Sí | No |
| Crear, editar o eliminar reglas de conocimiento | Sí | No | No |
| Eliminar entidades operativas | Sí | No | No |

### 2. Gestión operativa

En `/audits`, un administrador o auditor:

1. selecciona o crea un proyecto;
2. selecciona o crea una auditoría;
3. registra activos dentro de esa auditoría;
4. selecciona un activo y envía puerto, servicio o vulnerabilidad;
5. el frontend actualiza las consultas del dashboard al terminar.

Todas las entidades se guardan en PostgreSQL. Las mutaciones importantes generan
eventos en `AuditLog` con usuario, entidad y contexto de proyecto/auditoría.

### 3. Motor inteligente

Al recibir `POST /api/findings`, el backend ejecuta este flujo:

1. valida y normaliza el payload;
2. infiere puerto, sistema operativo, servicio, versión y vulnerabilidad;
3. consulta sólo reglas activas en PostgreSQL;
4. calcula el riesgo sumando el aporte de cada regla y limitándolo a `0-100`;
5. busca historial del mismo activo;
6. detecta vulnerabilidades repetidas, historial crítico o múltiples servicios;
7. genera recomendaciones sin duplicados;
8. redacta una explicación basada en reglas y puntajes reales;
9. persiste todo en una transacción: hallazgo, análisis, relaciones, riesgo del
   activo y log de auditoría.

Cada análisis conserva:

- versión del motor;
- inferencia obtenida;
- reglas coincidentes;
- aporte de riesgo por regla, suma original y límite;
- identificadores MITRE, OWASP y CWE;
- señales y eventos correlacionados;
- recomendaciones;
- explicación textual;
- línea de tiempo estructurada del procesamiento.

### 4. Idempotencia

El endpoint de hallazgos acepta `Idempotency-Key`. El frontend genera una clave
para cada envío. Si el cliente pierde la respuesta puede reenviar exactamente la
misma clave y payload:

- la primera solicitud crea el hallazgo y responde `202`;
- un reintento idéntico devuelve el mismo hallazgo con `200`;
- no se duplican el hallazgo, análisis ni log;
- usar la clave con otro payload responde `409`;
- dos solicitudes simultáneas con la misma clave también producen un solo
  registro.

Las claves se transforman con el identificador del usuario antes de guardarse,
por lo que quedan aisladas entre cuentas. La huella del payload usa una
representación canónica para no depender del orden de sus propiedades.

### 5. Base de conocimiento

La ruta `/knowledge` está disponible para todos los usuarios autenticados:

- todos pueden listar, buscar y filtrar reglas;
- sólo `ADMIN` ve y usa los controles de creación, edición, activación y
  eliminación;
- cada cambio administrativo se registra en `AuditLog`.

Una condición es JSON y debe coincidir con la inferencia. Ejemplos:

```json
{ "port": 21 }
```

```json
{ "vulnerability": "CVE-2021-44228" }
```

Una regla también incluye riesgo base, prioridad, recomendación, estado e
identificadores MITRE/OWASP/CWE.

## Pantallas disponibles

- `/login`: autenticación real.
- `/`: métricas reales y hallazgos recientes.
- `/audits`: gestión operativa y registro manual de hallazgos.
- `/knowledge`: consulta y administración de reglas.
- `/settings`: suscripción Push y administración de la cola offline.

Las tarjetas, hallazgos recientes y series de 7, 30 o 90 días usan PostgreSQL.
Los filtros por proyecto, auditoría y activo se aplican en servidor.

## API disponible

Todas las rutas salvo login y salud requieren `Authorization: Bearer <token>`.

| Método y ruta | Uso | Permiso |
| --- | --- | --- |
| `POST /api/auth/login` | Iniciar sesión | Público |
| `GET /api/auth/me` | Restaurar sesión | Autenticado |
| `GET /api/dashboard/stats` | Métricas agregadas | Todos los roles |
| `GET /api/findings/recent` | Hallazgos recientes | Todos los roles |
| `GET /api/projects` | Listar proyectos | Todos los roles |
| `POST /api/projects` | Crear proyecto | ADMIN/AUDITOR |
| `GET/PATCH/DELETE /api/projects/:id` | Consultar, editar o eliminar | Según RBAC |
| `GET /api/audits` | Listar auditorías | Todos los roles |
| `POST /api/projects/:id/audits` | Crear auditoría | ADMIN/AUDITOR |
| `GET/PATCH/DELETE /api/audits/:id` | Consultar, editar o eliminar | Según RBAC |
| `GET /api/assets` | Listar activos | Todos los roles |
| `POST /api/audits/:id/assets` | Crear activo | ADMIN/AUDITOR |
| `GET/PATCH/DELETE /api/assets/:id` | Consultar, editar o eliminar | Según RBAC |
| `GET /api/findings` | Listar hallazgos | Todos los roles |
| `POST /api/findings` | Procesar hallazgo | ADMIN/AUDITOR |
| `GET/PATCH/DELETE /api/findings/:id` | Consultar, cambiar estado o eliminar | Según RBAC |
| `GET /api/knowledge/rules` | Listar y filtrar reglas | Todos los roles |
| `GET /api/knowledge/rules/:id` | Ver regla | Todos los roles |
| `POST /api/knowledge/rules` | Crear regla | ADMIN |
| `PATCH/DELETE /api/knowledge/rules/:id` | Editar o eliminar regla | ADMIN |
| `POST /api/imports/findings` | Importar Nmap XML, CSV o JSON | ADMIN/AUDITOR |
| `GET /api/exports/findings` | Exportar CSV o JSON filtrado | ADMIN/AUDITOR |
| `GET /api/notifications/configuration` | Consultar disponibilidad Push | Todos los roles |
| `POST/DELETE /api/notifications/subscriptions` | Activar o revocar Push | Todos los roles |

Los endpoints de listado admiten filtros como `projectId`, `auditId`, `assetId`,
`search`, `type` y `active`, según el recurso.

## Cómo ejecutar el proyecto

### Opción recomendada: Docker Compose

Desde la raíz:

```bash
export JWT_SECRET="un-secreto-local-largo"
docker compose up --build
```

Servicios:

- frontend: `http://localhost:5173`;
- backend: `http://localhost:3000`;
- PostgreSQL: `localhost:5432`.

El backend espera a que PostgreSQL esté saludable, aplica migraciones y ejecuta
el seed idempotente antes de iniciar.

Para detener los contenedores sin borrar datos:

```bash
docker compose down
```

No usar `docker compose down -v` salvo que se quiera borrar deliberadamente el
volumen de PostgreSQL.

### Usuario local creado por el seed

Sólo para desarrollo:

```text
Correo: admin@vulnmind.local
Contraseña: vulnmind-dev-only
Rol: ADMIN
```

El seed también crea un proyecto, una auditoría, tres activos y dos reglas de
ejemplo. Es idempotente y puede ejecutarse nuevamente.

### Ejecución y validación manual

Backend:

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm run build
npm test
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Las pruebas del backend necesitan PostgreSQL disponible en `localhost:5432` con
la configuración del `docker-compose.yml`. El script de pruebas define su propio
secreto JWT y limpia los datos de integración al finalizar.

Estado de la última verificación:

- Prisma format, validate, generate y migraciones: correctos;
- backend lint/build: correctos;
- backend: 26 de 26 pruebas unitarias e integrales aprobadas;
- frontend: 3 de 3 pruebas de componentes aprobadas;
- frontend lint/build PWA: correctos;
- no quedan advertencias de Fast Refresh;
- imágenes Docker de desarrollo y producción construidas correctamente;
- idempotencia secuencial y concurrente verificada contra PostgreSQL.

## Archivos importantes

- `backend/prisma/schema.prisma`: modelo de datos.
- `backend/prisma/migrations/`: migraciones versionadas.
- `backend/prisma/seed.js`: usuario y datos locales.
- `backend/src/routes/index.js`: catálogo real de rutas.
- `backend/src/controllers/`: validación y orquestación HTTP.
- `backend/src/repositories/`: consultas y transacciones Prisma.
- `backend/src/knowledge-engine/`: inferencia, reglas, riesgo, correlación,
  recomendaciones y explicación.
- `backend/src/app.test.js`: pruebas integrales de API y base de datos.
- `frontend/src/pages/Audits/`: gestión operativa.
- `frontend/src/pages/Knowledge/`: administración de conocimiento.
- `frontend/src/services/api.js`: contrato del frontend con la API.
- `docs/PROGRESS.md`: historial detallado por etapa.

El archivo `backend/src/store/memory.js` queda únicamente como vestigio del
prototipo y no participa en las rutas de producción.

## Trabajo implementado en el cierre

- Importadores con límite de 5 MB/1.000 registros, rechazo de XML con entidades,
  detalle de errores y deduplicación de activos.
- Cola Dexie aislada por usuario con borradores, estados, espera exponencial,
  sincronización al volver la red y resolución explícita de conflictos.
- Suscripciones Push persistentes, VAPID por variables de entorno, alertas para
  riesgo crítico y limpieza automática de endpoints expirados.
- Dashboard real con filtros, serie temporal, detalle de aportes, correlación,
  recomendaciones y timeline del motor.
- Exportaciones CSV/JSON resistentes a fórmulas de hoja de cálculo, filtradas,
  limitadas por rol y registradas en `AuditLog`.
- Pruebas de backend y frontend, CI con PostgreSQL, navegación móvil, carga
  diferida por pantalla e imagen Nginx para producción.

### Seguimiento no bloqueante

- Configurar secretos y claves VAPID reales en cada entorno; `.env.example`
  contiene sólo marcadores.
- React Router 7.18.1 conserva un aviso `npm audit` alto exclusivo del modo RSC.
  VulnMind funciona como SPA y no habilita RSC; se mantiene la versión publicada
  más reciente hasta que exista una actualización compatible.
- Los formatos de exportación definidos para esta entrega son CSV y JSON. PDF
  puede añadirse si el contrato académico o del cliente lo exige expresamente.

## Reglas para continuar sin romper lo existente

- Crear una migración Prisma para cualquier cambio de esquema; no usar `db push`
  como sustituto en cambios versionados.
- Mantener el paso de hallazgos por el motor; no insertar hallazgos directamente
  desde importadores u offline.
- Conservar `Idempotency-Key` en todos los reintentos.
- Mantener las mutaciones críticas y su `AuditLog` dentro de una transacción.
- Aplicar `requireAuth` y RBAC a toda ruta nueva.
- No volver a conectar rutas al store en memoria.
- Ejecutar lint, build y pruebas antes de cada commit.
- No versionar `.env`, secretos JWT, claves VAPID ni credenciales reales.

## Estado general

VulnMind queda funcional de extremo a extremo y probado contra PostgreSQL. No
quedan etapas funcionales abiertas en el plan 1–12; el trabajo posterior es de
operación del entorno, seguimiento de dependencias y evolución del producto.
