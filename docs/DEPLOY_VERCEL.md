# Despliegue de VulnMind en Vercel

VulnMind se despliega como dos proyectos Vercel conectados al mismo repositorio:

- `vulnmind-api`, con **Root Directory** `backend`.
- `vulnmind-web`, con **Root Directory** `frontend`.

También necesita una base PostgreSQL accesible desde Internet. Puede ser Neon,
Supabase, Prisma Postgres u otro proveedor compatible. No uses la URL
`postgres:5432` de Docker Compose: ese host sólo existe en la red local de
Docker.

## 1. Preparar PostgreSQL

1. Crea una base PostgreSQL en la región más cercana posible a la Function.
2. Copia su cadena de conexión con SSL y, preferentemente, pooling:

   ```env
   DATABASE_URL=postgresql://usuario:clave@host:5432/base?sslmode=require
   ```

3. Desde `backend`, aplica las migraciones a esa base:

   ```bash
   npm ci
   DATABASE_URL='TU_URL_REAL' npm run prisma:migrate
   ```

No ejecutes `npm run prisma:seed` en producción: crea usuarios de demostración
con contraseñas conocidas. El primer usuario puede registrarse desde la
aplicación; por defecto se crea con rol `VIEWER`. Si necesitas un administrador,
actualiza ese usuario directamente en PostgreSQL una sola vez:

```sql
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'tu-correo@example.com';
```

## 2. Crear el proyecto del backend

1. En Vercel abre **Add New → Project** e importa este repositorio.
2. En **Root Directory**, selecciona `backend`.
3. Vercel detectará Express. Los demás valores quedan definidos por
   `backend/vercel.json`; el comando de instalación puede permanecer en
   `npm install`/automático.
4. Agrega en **Settings → Environment Variables**, al menos para Production:

   ```env
   DATABASE_URL=TU_URL_POSTGRESQL
   JWT_SECRET=UN_VALOR_ALEATORIO_LARGO
   ```

5. Opcionalmente agrega `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y
   `VAPID_SUBJECT`. Genera el par con `npm run vapid:generate` dentro de
   `backend`.
6. Despliega y copia el dominio asignado, por ejemplo
   `https://vulnmind-api.vercel.app`.
7. Verifica:

   ```text
   https://vulnmind-api.vercel.app/health
   ```

Debe responder un JSON con `status: "OK"`.

## 3. Crear el proyecto del frontend

1. Vuelve a **Add New → Project** e importa el mismo repositorio.
2. Esta vez selecciona `frontend` como **Root Directory**.
3. Agrega esta variable en **Settings → Environment Variables**:

   ```env
   VITE_API_URL=https://vulnmind-api.vercel.app/api
   ```

   Sustituye el dominio por el dominio real del backend y conserva `/api`.

4. Despliega. `frontend/vercel.json` hace que las rutas internas de React, como
   `/audits` o `/settings`, funcionen también al recargar directamente.

## 4. Verificación final

1. Abre la URL del frontend.
2. Registra un usuario y comprueba inicio/cierre de sesión.
3. Verifica que Dashboard y Auditorías carguen sin errores.
4. Prueba recargar directamente una ruta distinta de `/`.
5. Si configuraste VAPID, habilita notificaciones desde Settings.
6. Revisa **Observability → Runtime Logs** del backend si alguna petición falla.

Las importaciones están limitadas a 3 MB para dejar margen bajo el límite de
4,5 MB por petición de Vercel Functions.

## Actualizaciones posteriores

Cada `git push` desplegará ambos proyectos. Si un cambio agrega una migración:

1. Aplica `npm run prisma:migrate` con la `DATABASE_URL` de producción.
2. Publica el cambio.

Cuando cambies una variable en Vercel debes crear un nuevo deployment; los
deployments existentes no reciben el valor actualizado.
