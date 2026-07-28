/** Punto de arranque: abre el servidor HTTP usando el puerto del entorno. */
import app from './app.js';
import { disconnectPrisma } from './database/prisma.js';

const PORT = process.env.PORT || 3000;

// Vercel importa esta instancia como una Function. En ejecución local y Docker
// seguimos abriendo un puerto HTTP normalmente.
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
