# Progreso de VulnMind

Última actualización: 2026-07-23

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

## Fases siguientes

- FASE 4: CRUD y relaciones operativas completas.
- FASE 5: base de conocimiento persistente y administración.
- FASE 6: motor inteligente persistente, idempotente y explicable.
- FASE 7: importación Nmap XML, CSV y JSON.
- FASE 8: PWA offline, cola de sincronización y conflictos.
- FASE 9: notificaciones Push con VAPID.
- FASE 10: dashboard y explicabilidad visual con datos reales.
- FASE 11: exportaciones con control de permisos.
- FASE 12: cobertura de pruebas, Docker, CI/CD y documentación final.
