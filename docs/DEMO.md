# Guía de demostración de VulnMind

Duración sugerida: 8–10 minutos.

## 1. Preparación

1. Copia `.env.example` como `.env`.
2. Define un `JWT_SECRET` local.
3. Opcionalmente genera y configura VAPID con `npm run vapid:generate`.
4. Ejecuta `docker compose up --build`.
5. Abre `http://localhost:5173` e ingresa con:
   - correo: `admin@vulnmind.local`;
   - contraseña: `vulnmind-dev-only`.

Si el puerto 3000 está reservado, cambia `BACKEND_PORT` en `.env`, por ejemplo
a `3200`, antes de iniciar los contenedores.

## 2. Dashboard y filtros

1. Explica las cuatro métricas calculadas desde PostgreSQL.
2. Cambia entre 7, 30 y 90 días.
3. Selecciona proyecto, auditoría y activo para mostrar que el filtro se aplica
   también a la serie temporal y hallazgos recientes.
4. Abre un hallazgo reciente y presenta:
   - explicación del puntaje;
   - aportes por regla;
   - correlación histórica;
   - línea de procesamiento;
   - recomendaciones.

## 3. Registro manual e importación

1. En **Auditorías**, muestra la jerarquía proyecto → auditoría → activo.
2. Registra un hallazgo con puerto o CVE.
3. Importa un Nmap XML, CSV o JSON.
4. Repite el mismo archivo y comprueba que el resumen lo clasifica como
   “ya existente” sin duplicar hallazgos.
5. Usa un archivo parcialmente inválido para enseñar los errores por fila/host.

## 4. Operación offline

1. Desactiva temporalmente la red desde las herramientas del navegador.
2. Registra un hallazgo y comprueba el aviso de guardado local.
3. Abre **Configuración** para mostrar el elemento pendiente.
4. Recupera la red y verifica que cambia a sincronizado.
5. Explica que `404/409` quedan como conflicto y permiten descartar o reintentar
   como una copia con nueva clave.

## 5. Push y exportaciones

1. En **Configuración**, activa alertas si VAPID está configurado.
2. Explica que riesgos de 70 o más generan Web Push y que endpoints expirados se
   limpian automáticamente.
3. En el dashboard, exporta CSV y JSON.
4. Menciona que sólo `ADMIN`/`AUDITOR` pueden exportar y que cada descarga queda
   registrada en `AuditLog`.

## 6. Base de conocimiento y roles

1. En **Conocimiento**, crea o modifica una regla como `ADMIN`.
2. Inicia sesión como `VIEWER` si existe una cuenta de demostración para enseñar
   la vista de sólo lectura.
3. Destaca que todas las mutaciones importantes generan trazabilidad.

## 7. Cierre técnico

- 3 migraciones Prisma aplicadas.
- 26 pruebas de backend y 3 pruebas de frontend aprobadas.
- Lint y builds limpios.
- CI con PostgreSQL y migraciones reales.
- Imágenes Docker de desarrollo y Nginx de producción verificadas.
