# VulnMind

VulnMind es una Progressive Web App (PWA) diseñada para funcionar como un asistente inteligente en auditorías de ciberseguridad. A diferencia de un sistema normal donde solo guardas datos, VulnMind procesa los hallazgos que registras y utiliza un motor de reglas interno para generar automáticamente recomendaciones, niveles de riesgo, y asociar técnicas de MITRE ATT&CK y categorías de OWASP.

## Características Principales

- **Motor Inteligente**: Analiza los hallazgos, correlaciona vulnerabilidades y genera recomendaciones en tiempo real.
- **Soporte Offline**: Al ser una PWA con almacenamiento local (Dexie.js), puedes registrar hallazgos sin conexión a Internet y sincronizarlos cuando vuelvas a tener red.
- **Dashboard tipo SOC**: Interfaz profesional inspirada en herramientas empresariales de ciberseguridad, con gráficos interactivos y mapas de riesgo.
- **Explicabilidad**: El sistema siempre te explicará por qué tomó una decisión (por ejemplo, por qué aumentó un nivel de riesgo).

## Tecnologías Utilizadas

- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, Zustand, React Query.
- **Backend**: Node.js, Express, Prisma.
- **Base de Datos**: PostgreSQL.
- **Infraestructura**: Docker Compose.

## Cómo levantar el proyecto localmente

1. Clona el repositorio.
2. Asegúrate de tener instalado [Docker](https://www.docker.com/) y `docker-compose`.
3. Levanta los contenedores:
   ```bash
   docker-compose up --build
   ```
4. El Frontend estará disponible en `http://localhost:5173` y la API en `http://localhost:3000`.

## Procesamiento idempotente de hallazgos

`POST /api/findings` admite el encabezado `Idempotency-Key`. Debe conservarse la
misma clave al reintentar una solicitud: si el payload coincide, la API devuelve
el hallazgo ya procesado sin duplicarlo; si la clave se reutiliza con otro
payload, responde con `409 Conflict`.

```http
POST /api/findings
Authorization: Bearer <token>
Idempotency-Key: audit-device-01-scan-0001
Content-Type: application/json
```

La respuesta incluye el desglose del riesgo, reglas aplicadas, señales de
correlación, versión del motor y línea de tiempo que justifican el resultado.

---
*Desarrollado para optimizar y asistir en los procesos de auditoría técnica.*
