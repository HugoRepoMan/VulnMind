# 🛡️ VulnMind: Estado del Proyecto y Avances

Este documento detalla el progreso actual del proyecto **VulnMind** (Sistema Inteligente de Apoyo a Auditorías de Ciberseguridad), abarcando desde su concepción técnica hasta el prototipo funcional actual.

---

## ✅ Lo que se ha hecho hasta ahora (Avances)

### 1. Inicialización y Arquitectura Base
- **Estructura de Repositorio:** Configuración limpia separando la lógica en dos grandes bloques: `/backend` y `/frontend`.
- **Control de Versiones:** Repositorio enlazado y subido a GitHub (rama `main`), usando JavaScript puro (eliminando cualquier dependencia o configuración accidental de TypeScript).
- **Dockerización Inicial:** Se escribió un `docker-compose.yml` base para manejar una futura base de datos PostgreSQL, junto con la construcción en contenedores de ambos servicios.

### 2. Backend (Node.js + Express)
- **Framework y Middlewares:** Configuración de Express con soporte de CORS y parsing JSON.
- **Modelado de Datos (Prisma):** Se creó el `schema.prisma` utilizando el feature de `multiSchema`.
  - Esquema `public`: Entidades como `User`, `Project`, `Asset`, `Finding` y `AuditLog`.
  - Esquema `knowledge`: Entidades analíticas como `KnowledgeRule` y `FindingAnalysis`.
- **Motor Inteligente (Knowledge Engine):** Se implementó una arquitectura modular escalable para el procesamiento de vulnerabilidades, separada por responsabilidades:
  - `inference/`: Deducción de tipo de activo, OS o servicio.
  - `knowledge/`: Emparejamiento del hallazgo contra reglas predefinidas.
  - `scoring/`: Cálculo de nivel de riesgo (Crítico, Alto, Medio, Bajo).
  - `correlation/`: Búsqueda de relaciones con vulnerabilidades previas en el mismo activo.
  - `recommendations/`: Sugerencias de mitigación.
  - `timeline/` y `explainability/`: Registro de la línea de tiempo y trazabilidad de por qué se asignó el riesgo.
- **Almacén en Memoria (Prototipo Rápido):** Para evitar la fricción inicial de levantar contenedores Docker, se creó un almacén volátil en memoria (`store/memory.js`) permitiendo tener un MVP 100% funcional de forma inmediata.
- **API RESTful:**
  - `POST /api/findings`: Procesa nuevos datos.
  - `GET /api/dashboard/stats`: Extrae métricas agregadas (Riesgo Global, Hallazgos Críticos, etc.).
  - `GET /api/findings/recent`: Devuelve los últimos registros.

### 3. Frontend (React + Vite)
- **Enrutamiento y Estado:** Implementación de `react-router-dom` v6 (con manejo de Errores 404) y gestores de estado asíncrono (`@tanstack/react-query`).
- **Diseño UI/UX (Estilo SOC Empresarial):**
  - Incorporación del sistema de diseño moderno con **TailwindCSS** y **Shadcn/UI** (componentes reutilizables, accesibles y estéticos).
  - Creación de Layout principal compuesto por una `Sidebar` lateral y una `Navbar` superior.
- **Vistas Completadas:**
  - **SOC Dashboard (`/`):** Paneles de métricas (`RiskCards`), gráfica de evolución de riesgo (`RiskChart` integrada con Recharts) y lista en vivo de problemas (`RecentFindings`).
  - **Auditorías (`/audits`):** Panel para gestionar y reportar manualmente anomalías (activos y puertos expuestos).
- **Integración Real (API):** Consumo total de los endpoints del backend mediante el servicio Axios (`services/api.js`). El envío de un hallazgo invalida la caché automáticamente, refrescando todas las gráficas sin recargar la página.

---

## ⏳ Lo que falta por hacer (Siguientes Pasos)

A pesar de tener un prototipo totalmente interactivo, las siguientes tareas son necesarias para culminar el proyecto según la planificación original:

### 1. Migración a Base de Datos Definitiva
- Reemplazar el `store/memory.js` actual del backend con la conexión real a **PostgreSQL** a través de **Prisma Client**.
- Realizar las migraciones (`prisma db push` / `prisma migrate`) cuando el motor Docker local esté activo.

### 2. Expansión de la Base de Conocimiento
- Alimentar el motor (`knowledge/`) con un catálogo robusto de reglas reales (ej: base de datos de CVEs comunes, top 10 OWASP y mapeo estricto de tácticas MITRE ATT&CK).

### 3. Pruebas Unitarias (Responsabilidad de tu compañera)
- Escribir casos de prueba usando el framework **Jest** (o Vitest) para verificar la precisión del Motor Inteligente (asegurarse de que si el motor detecta un puerto FTP expuesto, asigne correctamente el puntaje de riesgo esperado).

### 4. Pulido de Características Avanzadas (Opcional/Fase Final)
- **PWA / Offline-First:** Configurar los service workers e integrar **Dexie.js** (IndexedDB) para que los auditores puedan registrar hallazgos incluso sin conexión a internet, sincronizándose cuando recuperen conectividad.
- Autenticación: Implementar una pantalla de login real con validación JWT en el backend y asignación de roles.

---

**Estado de salud general del proyecto:** 🟢 Excelente. La arquitectura base es sumamente sólida, modular y escalable. El prototipo cumple su función de visualización de datos en tiempo real de forma inmediata.
