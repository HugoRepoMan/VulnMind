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

## FASE 6 — Motor inteligente persistente, idempotente y explicable

Estado: completada.

Completado:

- Versionado el motor y persistida su versión junto con cada análisis.
- Añadido un desglose determinista del riesgo con aporte por regla, suma
  original, límite aplicado y método de cálculo.
- Mejorada la correlación contra el historial del activo para detectar
  vulnerabilidades repetidas, antecedentes críticos y múltiples servicios
  expuestos.
- Generadas explicaciones basadas en los nombres y aportes reales de las reglas,
  el límite del puntaje y las señales de correlación encontradas.
- Persistida una línea de tiempo estructurada con inferencia, reglas, puntaje,
  correlación y generación de la explicación.
- Implementado `Idempotency-Key` con huella canónica del payload, aislamiento por
  usuario y restricción única en PostgreSQL.
- Los reintentos idénticos recuperan el resultado original sin crear hallazgos,
  análisis ni logs duplicados; reutilizar la clave con otro payload devuelve
  `409`.
- Controlada la carrera entre solicitudes concurrentes: una persiste y la otra
  recupera el resultado confirmado.
- Endurecida la validación de los datos inferibles, incluido el rango de puertos.
- El frontend genera claves de idempotencia para nuevos hallazgos y la
  documentación describe el contrato para clientes externos.

Verificación final:

- Prisma format, validate, generate y migración correctos.
- Backend: lint y build correctos; 12/12 pruebas de integración correctas.
- Frontend: lint correcto con las 3 advertencias preexistentes de Fast Refresh y
  build PWA correcto.
- Reintentos secuenciales, conflicto de payload y concurrencia verificados contra
  PostgreSQL local.

## FASES 7–12 — Entrada masiva, resiliencia y entrega

Estado: completadas el 27 de julio de 2026.

Completado:

- Importación Nmap XML, CSV y JSON mediante un modelo normalizado, asociación de
  activos, motor común, claves idempotentes por contenido y resumen por registro.
- Borradores y cola Dexie con aislamiento por usuario, espera exponencial,
  conservación de claves, sincronización al volver la red y conflictos visibles.
- Web Push con claves VAPID externas, suscripciones persistentes por usuario,
  alertas críticas y limpieza de endpoints expirados.
- Dashboard con filtros reales, series de 7/30/90 días y detalle visual de
  reglas, riesgo, correlación, timeline y recomendaciones.
- Exportación CSV/JSON con RBAC, filtros, contexto completo, neutralización de
  fórmulas y registro `FINDINGS_EXPORTED`.
- Pruebas unitarias del motor y parsers, pruebas integrales de la API y pruebas
  de componentes del dashboard.
- CI actualizado a Node 24 con PostgreSQL y migraciones; Docker de desarrollo y
  producción validado, Nginx para SPA/API, navegación móvil y rutas diferidas.

Verificación final:

- Migraciones Prisma: 3/3 aplicadas.
- Backend: lint/build correctos y 26/26 pruebas aprobadas.
- Frontend: lint sin advertencias, 3/3 pruebas y build PWA correctos.
- Imágenes Docker de backend, frontend de desarrollo y frontend Nginx de
  producción construidas correctamente.
- Auditoría de dependencias de producción del backend: 0 vulnerabilidades.
- React Router mantiene un aviso RSC no aplicable a esta SPA; se usa la versión
  publicada más reciente (7.18.1).

## Grafo de rutas de ataque — normalización semántica y layout ELK

Estado: completado el 27 de julio de 2026.

Hallazgos de la inspección:

- La vista anterior dibujaba un SVG propio y asignaba posiciones con
  `x = columna * 280` e `y = fila * 115`; no utilizaba una librería de grafos.
- La vulnerabilidad se identificaba globalmente como `vulnerability:<CVE>`.
  Esto fusionaba hallazgos distintos y hacía que una CVE pareciera relacionada
  con servicios sin evidencia correspondiente.
- La consulta aceptaba proyecto sin auditoría, por lo que mezclaba activos de
  escaneos diferentes. Ésta era la causa de repeticiones visuales como
  `web-prod-01` y `gateway` al cambiar de contexto.
- El resaltado consideraba activa cualquier arista cuyos extremos estuvieran en
  la ruta, aunque esa arista no perteneciera a ella.
- Las conexiones de correlación se añadían sobre terminales genéricos y el
  layout manual producía cruces, retornos y grandes zonas vacías.
- El parser JSON descartaba campos del paquete (`assetIp`, `protocol`,
  `externalId`, `internetExposed`, `assetCriticality`, `relatedAsset`, título y
  etiquetas), lo que impedía justificar varias relaciones.

Correcciones de datos:

- La API exige una auditoría y tanto activos como hallazgos se filtran por ella.
- Se añadió una transformación pura basada en `Map`, con IDs estables:
  `asset:<id>`, `service:<assetId>:<protocol>:<port>`,
  `vulnerability:<findingId>:<vulnerabilityId>`,
  `identity:<findingId>:<identity>` y `evidence:<findingId>`.
- Las aristas usan `edge:<source>:<target>:<tipo>` y se deduplican junto con sus
  nodos. Reprocesar el mismo conjunto es idempotente.
- Activo-servicio sólo se crea por el puerto persistido; servicio-vulnerabilidad
  y entidad-evidencia se crean dentro del hallazgo exacto. Las correlaciones
  requieren IDs persistidos o etiquetas y activo relacionado explícitos.
- La selección de ruta conserva `nodeIds` y `edgeIds`; ya no infiere una ruta
  sólo porque dos nodos estén activos.
- El parser conserva los campos reales del paquete sin introducir datos
  simulados. El Motor Inteligente y sus análisis persistidos no se modificaron.

Correcciones visuales:

- React Flow reemplaza el SVG manual y ELK.js `layered` calcula el layout en
  dirección `RIGHT`, con enrutamiento ortogonal, `NETWORK_SIMPLEX`,
  `LAYER_SWEEP`, separación entre capas/nodos/aristas y padding.
- El layout se recalcula al cambiar auditoría, filtros, rutas, conexiones o
  grupos colapsados, y después ajusta la cámara con padding moderado.
- Se añadieron vista general, selector y enfoque de rutas, cámara centrada,
  opacidad contextual, zoom, desplazamiento, ajuste a pantalla, reorganización,
  pantalla completa, minimapa para grafos grandes y controles.
- Los activos pueden colapsarse; la ruta seleccionada permanece visible. Los
  nodos tienen handles distribuidos, dimensiones por categoría, severidad en
  insignia, tooltips, truncado y panel lateral con metadatos y relaciones.
- Las aristas tienen flecha, etiqueta sólo al enfocarse, indicación ámbar para
  reglas de correlación y resaltado por nodo o ruta.

Verificación con `03a_hallazgos_array.json`:

- El verificador oficial del paquete informó: todos los archivos válidos.
- 5 registros aceptados, 0 rechazados.
- 2 activos únicos, 16 nodos, 16 conexiones válidas y 11 rutas demostrables.
- `web-prod-01` aparece una sola vez y `db-main` aparece una sola vez.
- Servicios únicos: `web-prod-01/tcp/8080`, `web-prod-01/tcp/21` y
  `db-main/tcp/5432`.
- La única arista entrante de `CVE-2021-44228` desde un servicio es:
  `web-prod-01/tcp/8080 → CVE-2021-44228`. FTP y PostgreSQL no se conectan con
  Log4Shell.
- La ruta crítica obtenida contiene:
  `Internet → web-prod-01 → tcp/8080 → CVE-2021-44228 → credenciales
  reutilizadas → db-main → tcp/5432 → CWE-250 → privilegios excesivos →
  evidencia`.

Pruebas y validación:

- Backend: 37/37 pruebas, lint y build correctos.
- Frontend: 7/7 pruebas, lint sin errores y build PWA correcto.
- Las pruebas nuevas cubren deduplicación de activos, servicios y aristas;
  aislamiento por auditoría; idempotencia; asociación exacta de Log4Shell;
  ausencia de aristas inventadas; posiciones ELK válidas/no superpuestas;
  resaltado exacto de rutas; colapso y ajuste a pantalla.

## Administración de usuarios y acceso

Estado: completada el 27 de julio de 2026.

- Añadida gestión de usuarios exclusiva para administradores desde
  Configuración.
- Los administradores pueden crear cuentas con roles `ADMIN`, `AUDITOR` o
  `VIEWER`, cambiar roles, activar/desactivar cuentas y restablecer contraseñas.
- Las contraseñas se validan y almacenan únicamente como hash bcrypt.
- Las cuentas desactivadas no pueden iniciar sesión y sus tokens existentes
  dejan de ser válidos inmediatamente.
- Se impide desactivar la cuenta propia y desactivar o degradar al último
  administrador activo.
- Creación, cambio de permisos y restablecimiento de contraseña generan eventos
  en `AuditLog`, sin registrar contraseñas.
- Migración `20260727013000_user_administration` aplicada correctamente.

Verificación:

- Backend: 38/38 pruebas, lint y build correctos.
- Frontend: 7/7 pruebas, lint sin errores y build PWA correcto.
- Verificados permisos `403` para usuarios no administradores, correo duplicado,
  cambio de rol, restablecimiento de contraseña, invalidación de sesiones y
  protección de la cuenta administrativa.

## Registro público con acceso mínimo

Estado: completado el 27 de julio de 2026.

- Añadido `/register` y el endpoint público `POST /api/auth/register`.
- Toda cuenta registrada se crea activa con rol `VIEWER`; los campos `role` o
  `active` enviados por el cliente se ignoran.
- El registro usa la misma protección bcrypt de las cuentas administrativas y
  genera el evento `USER_SELF_REGISTERED` en `AuditLog`.
- Un `VIEWER` sólo puede abrir el Dashboard. La navegación no muestra
  auditorías, conocimiento, rutas de ataque, remediaciones o configuración.
- Las guardas de React redirigen al Dashboard si un `VIEWER` intenta abrir
  manualmente una ruta operativa.
- La API también devuelve `403` para esas operaciones; ocultar enlaces no se
  utiliza como mecanismo de seguridad.
- Se mantienen únicamente los endpoints de estadísticas, hallazgos recientes y
  listas necesarias para los filtros del Dashboard.
- El administrador puede promover posteriormente la cuenta a `AUDITOR` desde
  Configuración → Usuarios y acceso.

Verificación:

- El intento de autorregistrarse enviando `role: ADMIN` produjo una cuenta
  `VIEWER`.
- La cuenta pudo consultar Dashboard, filtros y hallazgos recientes.
- La misma cuenta recibió `403` al consultar reglas, hallazgos operativos y el
  grafo de ataque.
- Backend: 39/39 pruebas aprobadas.
