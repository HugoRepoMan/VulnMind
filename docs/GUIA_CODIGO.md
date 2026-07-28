# Guía sencilla del código de VulnMind

Esta guía explica dónde empieza cada flujo, qué archivo toma las decisiones y
dónde se guardan finalmente los datos. El código fuente también contiene
comentarios junto a los bloques donde una decisión no resulta obvia.

## Credenciales locales de demostración

| Rol | Correo | Contraseña | Acceso |
|---|---|---|---|
| ADMIN | `admin@vulnmind.local` | `vulnmind-dev-only` | Todo el sistema y administración de usuarios |
| AUDITOR | `auditor@vulnmind.local` | `auditor-dev-only` | Auditorías, activos, hallazgos, reglas de lectura, grafo y remediaciones |
| VIEWER | `viewer@vulnmind.local` | `viewer-dev-only` | Sólo Dashboard |

Estas cuentas se crean en `backend/prisma/seed.js`. Son únicamente para
desarrollo. En producción deben eliminarse o cambiarse y nunca deben conservar
estas contraseñas.

## Recorrido de una petición

1. Una página llama una función de `frontend/src/services/api.js`.
2. Axios añade el JWT que se encuentra en `frontend/src/store/index.js`.
3. `backend/src/routes/index.js` localiza el endpoint y comprueba el rol.
4. `backend/src/middlewares/auth.js` valida el JWT y confirma en PostgreSQL que
   la cuenta sigue activa.
5. Un controlador valida parámetros y cuerpo.
6. Un servicio aplica la regla de negocio.
7. Un repositorio o Prisma lee/escribe PostgreSQL.
8. La respuesta vuelve a React Query, que actualiza la interfaz.

## Backend: archivos principales

### Arranque y seguridad

- `backend/src/index.js`: abre el puerto HTTP.
- `backend/src/app.js`: ensambla Express, CORS, Helmet, rutas y errores.
- `backend/src/routes/index.js`: matriz central de endpoints y roles.
- `backend/src/middlewares/auth.js`:
  - `requireAuth`: valida JWT y estado actual de la cuenta.
  - `allowRoles`: rechaza roles no autorizados con `403`.
- `backend/src/middlewares/errorHandler.js`: convierte errores a respuestas JSON.
- `backend/src/database/prisma.js`: cliente compartido de PostgreSQL.

### Usuarios y autenticación

- `backend/src/controllers/auth.controller.js`:
  - `register`: registra siempre como `VIEWER`.
  - `login`: valida el formulario e inicia la sesión.
  - `getSession`: devuelve el usuario de la sesión vigente.
- `backend/src/services/auth.service.js`:
  - `registerViewer`: cifra contraseña, crea cuenta y AuditLog.
  - `authenticateUser`: compara bcrypt y firma el JWT.
  - `findPublicUserById`: confirma que una cuenta siga activa.
- `backend/src/controllers/user.controller.js`:
  - `listUsers`: listado administrativo sin hashes.
  - `createUser`: creación directa por ADMIN.
  - `updateUser`: cambia rol o estado.
  - `resetUserPassword`: reemplaza el hash.
  - `ensureAdminRemains`: protege al último administrador.

### Datos operativos

- `backend/src/controllers/operations.controller.js`: CRUD de proyectos,
  auditorías, activos y estados de hallazgos.
- `backend/src/services/finding.service.js`: caso de uso de creación idempotente.
- `backend/src/repositories/finding.repository.js`: transacción que persiste el
  hallazgo, análisis, reglas, riesgo y AuditLog.
- `backend/src/services/finding-filter.service.js`: filtros compartidos.

### Motor Inteligente

- `backend/src/knowledge-engine/index.js`: ejecuta todas las etapas en orden.
- `knowledge-engine/inference/index.js`: normaliza servicio, SO, versión y CVE.
- `knowledge-engine/knowledge/index.js`: busca reglas coincidentes.
- `knowledge-engine/scoring/index.js`: suma aportes y limita el riesgo a 100.
- `knowledge-engine/correlation/index.js`: busca relaciones con el historial.
- `knowledge-engine/recommendations/index.js`: produce acciones de mitigación.
- `knowledge-engine/explainability/index.js`: explica por qué se obtuvo el riesgo.
- `backend/src/repositories/knowledge.repository.js`: consulta reglas activas.

### Importaciones y análisis avanzados

- `backend/src/services/import-parser.service.js`: interpreta Nmap XML, CSV y JSON.
- `backend/src/controllers/import.controller.js`: asocia activos y procesa filas.
- `backend/src/services/scan-comparison.service.js`: diferencia dos escaneos.
- `backend/src/services/attack-graph.service.js`:
  - `transformPersistedAttackGraph`: genera nodos/aristas únicos.
  - `isExternallyReachable`: determina exposición con datos persistidos.
- `backend/src/controllers/attack-graph.controller.js`: consulta una auditoría.
- `backend/src/services/remediation-prioritization.service.js`: calcula prioridades.
- `backend/src/controllers/export.controller.js`: produce CSV/JSON trazable.

### Base de datos

- `backend/prisma/schema.prisma`: modelos, relaciones, índices y enumeraciones.
- `backend/prisma/migrations/`: historia reproducible de cambios del esquema.
- `backend/prisma/seed.js`: cuentas y datos mínimos locales.

Relación principal:

```text
User
  └─ Project
      └─ Audit
          └─ Asset
              └─ Finding
                  └─ FindingAnalysis ↔ KnowledgeRule
```

`AuditLog` registra quién realizó cambios importantes. `PushSubscription`
almacena suscripciones de navegador, no claves privadas VAPID.

## Frontend: archivos principales

### Arranque, sesión y navegación

- `frontend/src/main.jsx`: monta React y registra la PWA.
- `frontend/src/App.jsx`: crea la caché de React Query.
- `frontend/src/routes/index.jsx`: rutas y guardas por rol.
- `frontend/src/store/index.js`: usuario, JWT y tema persistidos.
- `frontend/src/services/api.js`: todas las llamadas al backend.
- `frontend/src/components/layout/Sidebar.jsx`: enlaces visibles según rol.
- `frontend/src/components/layout/Navbar.jsx`: identidad y cierre de sesión.

### Identidad

- `frontend/src/pages/Login/index.jsx`: formulario de acceso.
- `frontend/src/pages/Register/index.jsx`: autorregistro VIEWER.
- `frontend/src/pages/Settings/UserAdministration.jsx`: promoción, bloqueo y
  restablecimiento de contraseña por ADMIN.

### Pantallas operativas

- `frontend/src/pages/Dashboard/index.jsx`: métricas, filtros y hallazgos recientes.
- `frontend/src/pages/Audits/index.jsx`: proyectos, auditorías, activos,
  importación y registro manual.
- `frontend/src/components/audits/ScanComparison.jsx`: comparación entre activos.
- `frontend/src/pages/Knowledge/index.jsx`: reglas e importación JSON.
- `frontend/src/pages/Remediations/index.jsx`: prioridades calculadas.

### Grafo de ataque

- `frontend/src/pages/AttackGraph/index.jsx`: interacción y selección de ruta.
- `graph-layout.js`: ELK layered, colapso y resaltado.
- `AttackNode.jsx`: aspecto y handles de nodos.
- `AttackEdge.jsx`: flechas, etiquetas y correlaciones.

### Modo offline y notificaciones

- `frontend/src/db/index.js`: tablas IndexedDB.
- `frontend/src/services/offline.js`: cola y reintentos idempotentes.
- `frontend/src/hooks/useOfflineSync.js`: reanuda operaciones al recuperar red.
- `frontend/public/push-sw.js`: muestra notificaciones Web Push.

## Permisos

| Recurso | VIEWER | AUDITOR | ADMIN |
|---|---:|---:|---:|
| Dashboard y filtros | Sí | Sí | Sí |
| Auditorías/hallazgos | No | Sí | Sí |
| Grafo/remediaciones | No | Sí | Sí |
| Consultar conocimiento | No | Sí | Sí |
| Crear o importar reglas | No | No | Sí |
| Administrar usuarios | No | No | Sí |
| Eliminar entidades | No | No | Sí |

Las restricciones existen en React para orientar al usuario y en Express para
aplicar seguridad real.

## Pruebas y comandos

```bash
docker compose exec -T backend npm test
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run build
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run build
```

Para restaurar las tres cuentas locales:

```bash
docker compose exec -T backend npx prisma db seed
```

## Dónde empezar a leer

Para entender el proyecto rápidamente:

1. `backend/prisma/schema.prisma`
2. `backend/src/routes/index.js`
3. `backend/src/services/finding.service.js`
4. `backend/src/knowledge-engine/index.js`
5. `frontend/src/routes/index.jsx`
6. `frontend/src/services/api.js`
7. La página concreta que se quiera modificar.
