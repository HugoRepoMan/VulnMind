# Progreso de VulnMind

Última actualización: 2026-07-26

## Diagnóstico inicial

El repositorio contiene un prototipo en JavaScript con React/Vite y Express. La
interfaz SOC, el formulario manual de hallazgos y tres endpoints están
implementados, pero el estado operativo se conserva únicamente en memoria. El
modelo Prisma inicial declara los esquemas `public` y `knowledge`, aunque todavía
no tiene la jerarquía `Project -> Audit -> Asset -> Finding`, migraciones, cliente
integrado ni seeds.

La autenticación, RBAC, importadores, sincronización offline, Push, exportaciones
y administración de conocimiento aún no están implementados. El gráfico de
riesgo y varios textos/botones de la interfaz usan datos estáticos. Los workflows
de CI existen, pero apuntan a Dockerfiles ausentes y originalmente no ejecutaban
pruebas reales en el backend.

## FASE 1 — Revisión y estabilización

Estado: completada.

Completado:

- Inventario y revisión de estructura, frontend, backend, Prisma, Docker Compose,
  API, motor inteligente, rutas, componentes y workflows.
- Dependencias instaladas de forma reproducible con `npm ci`.
- Frontend: lint y build de producción ejecutados correctamente.
- Corregido el import inexistente de `uuid` usando `crypto.randomUUID`.
- Corregido el contrato entre el motor y el store: el riesgo, las
  recomendaciones, la correlación y la explicación se completan antes de
  responder.
- Corregida la validación Zod 4 y la serialización de sus errores.
- Añadidas pruebas API reales para salud, procesamiento y payload inválido.
- Corregida la URL de la API usada por el frontend en Docker Compose.
- Actualizada la configuración incompatible de Prisma 7 y eliminada la
  configuración TypeScript; `prisma validate` finaliza correctamente.
- Añadidos Dockerfiles y `.dockerignore` para backend y frontend, además del
  healthcheck de PostgreSQL.
- Backend y frontend iniciados localmente; `/health`, las métricas del dashboard
  y la aplicación web respondieron correctamente.
- Verificación actual: backend lint/build correctos y 3/3 pruebas correctas;
  frontend lint correcto (3 advertencias no bloqueantes) y build PWA correcto.
- Docker Compose verificado manualmente con `docker compose up --build -d`:
  PostgreSQL alcanzó estado `healthy`, backend respondió en el puerto 3000,
  frontend respondió en el puerto 5173 y los tres servicios permanecieron
  activos.
- Los endpoints del dashboard respondieron correctamente durante la verificación
  en contenedores.
- La eliminación accidental del volumen ocurrió cuando estaba recién creado y
  no contenía datos importantes.

## FASE 2 — PostgreSQL y Prisma reales

Estado: completada.

Completado:

- Reemplazado el modelo inicial por la jerarquía relacional
  `Project -> Audit -> Asset -> Finding`, con estados, timestamps, claves
  foráneas, restricciones e índices.
- Conservado Prisma MultiSchema con datos operativos en `public` y reglas y
  análisis en `knowledge`.
- Añadida una instancia reutilizable de Prisma Client 7 con el adaptador oficial
  de PostgreSQL.
- Añadidos repositorios Prisma para hallazgos, métricas del dashboard y reglas de
  conocimiento.
- Eliminado el uso de `memory.js` de todas las rutas y componentes del motor en
  producción. El archivo queda disponible únicamente para pruebas unitarias
  aisladas.
- `POST /api/findings` persiste atómicamente `Finding`, `FindingAnalysis`, riesgo,
  recomendaciones, explicación, reglas relacionadas y `AuditLog`.
- El Motor Inteligente obtiene `KnowledgeRule` desde PostgreSQL y consulta
  hallazgos previos para la correlación.
- `GET /api/dashboard/stats` y `GET /api/findings/recent` consultan datos reales
  desde PostgreSQL manteniendo el contrato existente del frontend.
- Añadida migración versionada
  `20260723174546_phase_2_postgresql_persistence`.
- Añadido seed idempotente con usuario, proyecto, auditoría, tres activos y dos
  reglas mínimas de desarrollo, sin atribuir identificadores oficiales no
  verificados.
- Añadido manejo específico de errores conocidos y de inicialización de Prisma.
- Añadidas 4 pruebas de integración API contra PostgreSQL que verifican
  hallazgo, análisis, regla relacionada, riesgo del activo, log de auditoría,
  dashboard, recientes y validación sin persistencia.
- Backend configurado para generar Prisma Client al construir la imagen y
  ejecutar `migrate deploy` y el seed idempotente antes de iniciar.
- Persistencia comprobada tras reiniciar los contenedores PostgreSQL y backend
  sin eliminar el volumen: el hallazgo creado siguió disponible y las métricas
  conservaron sus valores.

Verificación final:

- Prisma format, validate y generate correctos.
- Backend: lint/build correctos y 4/4 pruebas de integración correctas.
- Frontend: lint correcto con 3 advertencias no bloqueantes y build PWA correcto.
- Docker Compose: PostgreSQL `healthy`, backend y frontend activos; endpoints de
  salud, dashboard y recientes correctos después del reinicio.

## FASE 3 — Autenticación y roles

Estado: completada.

Completado:

- Implementado `POST /api/auth/login` con validación Zod, búsqueda de usuario en
  PostgreSQL y verificación de contraseña mediante bcrypt.
- Implementado `GET /api/auth/me` para restaurar y validar la sesión activa.
- Añadidos JWT firmados con expiración de 8 horas, issuer y audience validados.
- `JWT_SECRET` es obligatorio y se inyecta mediante variable de entorno; el valor
  local no se almacena en Git.
- Añadido middleware de autenticación Bearer y respuestas 401 para tokens
  ausentes, inválidos o expirados.
- Añadido RBAC para `ADMIN`, `AUDITOR` y `VIEWER`: los tres roles pueden consultar
  dashboard y hallazgos; sólo `ADMIN` y `AUDITOR` pueden procesar hallazgos.
- Los hallazgos nuevos registran al usuario autenticado en `AuditLog` y cada
  inicio de sesión correcto crea un evento `LOGIN_SUCCESS`.
- Frontend conectado al login real, persistencia de sesión, interceptor Bearer,
  cierre de sesión, rutas protegidas y ocultamiento de acciones de auditoría para
  `VIEWER`.
- Añadidas pruebas de integración para login, sesión, 401, 403, permisos de
  escritura y atribución del log de auditoría.

Verificación final:

- Backend: lint/build correctos y 7/7 pruebas de integración correctas.
- Frontend: lint correcto con 3 advertencias no bloqueantes y build PWA correcto.
- Docker Compose válido con secreto local ignorado por Git.
- Flujo real en contenedores verificado: login 200, sesión 200 con rol `ADMIN`,
  dashboard 200 y hallazgos recientes 200.

## FASE 4 — CRUD y relaciones operativas completas

Estado: completada.

Completado:

- Añadidos endpoints de listado, detalle, creación, actualización y eliminación
  para proyectos, auditorías y activos respetando la jerarquía
  `Project -> Audit -> Asset`.
- Añadidos listado, detalle, actualización de estado y eliminación de hallazgos;
  la creación continúa pasando obligatoriamente por el Motor Inteligente.
- Las respuestas de detalle incluyen sus relaciones y conteos para evitar datos
  simulados en la interfaz.
- Añadida validación Zod para nombres, estados, fechas, IP, tipo y parámetros de
  relación, además de respuestas 404 para entidades inexistentes y 409 para
  conflictos de integridad.
- Aplicado RBAC uniforme: `ADMIN`, `AUDITOR` y `VIEWER` pueden consultar;
  `ADMIN` y `AUDITOR` pueden crear y editar; sólo `ADMIN` puede eliminar.
- Las creaciones y actualizaciones generan eventos trazables en `AuditLog` con
  usuario, proyecto, auditoría, entidad y campos modificados.
- Al eliminar un hallazgo se recalcula atómicamente el riesgo máximo del activo.
- Reemplazada la pantalla simulada de auditorías por una interfaz conectada a
  PostgreSQL que permite seleccionar y crear proyectos, auditorías y activos, y
  registrar hallazgos sobre activos reales.
- Corregida la prioridad de `/findings/recent` frente a
  `/findings/:findingId`, detectada por las pruebas de integración.

Verificación final:

- Backend: lint y build correctos; 9/9 pruebas de integración correctas.
- Frontend: lint correcto con las 3 advertencias preexistentes de Fast Refresh y
  build PWA correcto.
- CRUD relacional, validación, RBAC, logs y eliminación en cascada verificados
  contra PostgreSQL local.

## FASE 5 — Base de conocimiento persistente y administración

Estado: completada.

Completado:

- Añadido CRUD REST para reglas de conocimiento con listado, detalle, creación,
  edición, activación, desactivación y eliminación.
- Incorporados filtros por texto, tipo y estado, conteo de análisis relacionados
  y orden por actividad, prioridad y fecha de actualización.
- Validación estricta para condiciones JSON, puntaje de riesgo, prioridad,
  recomendación e identificadores MITRE, OWASP y CWE.
- Aplicado RBAC: todos los roles autenticados pueden consultar las reglas y sólo
  `ADMIN` puede modificarlas.
- Cada creación, actualización y eliminación queda registrada en `AuditLog` con
  el administrador responsable y los campos modificados.
- Añadida una pantalla de base de conocimiento conectada a PostgreSQL para
  buscar y consultar reglas; los administradores pueden gestionarlas desde la
  misma interfaz.
- Añadidas pruebas de integración para validación, permisos, filtros,
  persistencia, edición, eliminación y trazabilidad.

Verificación final:

- Backend: lint y build correctos; 10/10 pruebas de integración correctas.
- Frontend: lint correcto con las 3 advertencias preexistentes de Fast Refresh y
  build PWA correcto.
- Migraciones de Prisma al día y CRUD de conocimiento verificado contra
  PostgreSQL local.

## Fases siguientes

- FASE 6: motor inteligente persistente, idempotente y explicable.
- FASE 7: importación Nmap XML, CSV y JSON.
- FASE 8: PWA offline, cola de sincronización y conflictos.
- FASE 9: notificaciones Push con VAPID.
- FASE 10: dashboard y explicabilidad visual con datos reales.
- FASE 11: exportaciones con control de permisos.
- FASE 12: cobertura de pruebas, Docker, CI/CD y documentación final.
