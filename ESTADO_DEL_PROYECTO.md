# VulnMind: estado, funcionamiento y trabajo pendiente

Última actualización: 26 de julio de 2026

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

Las etapas 1 a 6 están terminadas. Quedan la importación de archivos, operación
offline completa, notificaciones, visualizaciones finales, exportaciones y el
cierre de calidad/entrega.

## Estado por etapa

| Etapa | Estado | Resultado principal |
| --- | --- | --- |
| 1. Estabilización | Completada | Dependencias, validaciones, pruebas, Dockerfiles y builds corregidos. |
| 2. PostgreSQL y Prisma | Completada | Persistencia real, migraciones, seed y transacciones. |
| 3. Autenticación y roles | Completada | Login JWT, sesión, RBAC y auditoría de accesos. |
| 4. CRUD operativo | Completada | Proyectos, auditorías, activos y hallazgos con relaciones reales. |
| 5. Base de conocimiento | Completada | CRUD de reglas, filtros, administración y trazabilidad. |
| 6. Motor inteligente | Completada | Idempotencia, correlación, desglose de riesgo y explicabilidad persistente. |
| 7. Importadores | Pendiente | Nmap XML, CSV y JSON. |
| 8. Offline y sincronización | Pendiente | Cola IndexedDB, reintentos y resolución de conflictos. |
| 9. Notificaciones Push | Pendiente | VAPID, suscripciones y eventos. |
| 10. Dashboard final | Pendiente | Serie temporal real y explicación visual. |
| 11. Exportaciones | Pendiente | Informes y control de permisos. |
| 12. Cierre | Pendiente | Más cobertura, CI/CD, Docker y documentación final. |

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
- Service worker PWA generado. Esto todavía no equivale a sincronización offline
  completa; esa parte pertenece al trabajo pendiente.

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
- `/settings`: marcador de posición; todavía no está implementada.

Importante: las tarjetas y hallazgos recientes del dashboard usan PostgreSQL,
pero la gráfica de evolución semanal todavía contiene datos estáticos. Se
reemplazará por una serie temporal real en la etapa 10.

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
- backend: 12 de 12 pruebas de integración aprobadas;
- frontend lint/build PWA: correctos;
- quedan 3 advertencias no bloqueantes de Fast Refresh preexistentes;
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

## Trabajo pendiente

### Prioridad inmediata: importadores

- Crear endpoints para importar Nmap XML, CSV y JSON.
- Validar tipo, tamaño y estructura de archivos.
- Convertir cada formato a un modelo común.
- Crear o asociar activos sin duplicarlos.
- Procesar cada hallazgo mediante el mismo motor e idempotencia.
- Devolver resumen de aceptados, rechazados y errores por fila/host.
- Añadir interfaz de carga y pruebas con archivos válidos y corruptos.

### Offline y sincronización

- Definir tablas Dexie para borradores y cola.
- Interceptar fallos de red sin perder registros.
- Conservar la misma clave de idempotencia durante todos los reintentos.
- Sincronizar al recuperar conexión.
- Mostrar estado pendiente/fallido/sincronizado.
- Resolver conflictos cuando una entidad cambió en servidor.

### Notificaciones Push

- Configurar claves VAPID sin almacenarlas en Git.
- Persistir suscripciones por usuario.
- Enviar alertas para riesgos críticos y eventos definidos.
- Permitir activar, revocar y limpiar suscripciones inválidas.

### Dashboard y explicabilidad visual

- Reemplazar la serie semanal estática por datos agregados reales.
- Añadir filtros por proyecto, auditoría, activo y periodo.
- Crear detalle visual de hallazgo con reglas, aportes, correlación y timeline.
- Conectar el botón “Nuevo Hallazgo” del dashboard o retirarlo.

### Exportaciones

- Definir formatos requeridos, por ejemplo PDF, CSV o JSON.
- Aplicar permisos y filtros al exportar.
- Incluir contexto, evidencia, riesgo, explicación y recomendaciones.
- Registrar exportaciones sensibles en `AuditLog`.

### Calidad y entrega final

- Añadir pruebas unitarias de cada módulo del motor además de las integrales.
- Probar errores de red, sesiones expiradas y más casos de cascada/conflicto.
- Aumentar cobertura del frontend.
- Revisar accesibilidad y diseño móvil.
- Resolver las advertencias de Fast Refresh y dividir el bundle grande.
- Confirmar workflows CI/CD y despliegue en un entorno limpio.
- Crear variables y secretos de producción; nunca reutilizar credenciales del
  seed.
- Actualizar README, capturas y guía de demostración final.

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

El núcleo operativo está estable y probado. Ya existe una base sólida para
continuar con importación y sincronización sin rehacer autenticación,
persistencia, reglas o procesamiento inteligente. Lo que queda se concentra en
entradas masivas, experiencia offline, presentación avanzada y preparación de
entrega.
