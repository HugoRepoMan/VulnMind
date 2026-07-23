import app from './app.js';
import { disconnectPrisma } from './database/prisma.js';

const PORT = process.env.PORT || 3000;

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
