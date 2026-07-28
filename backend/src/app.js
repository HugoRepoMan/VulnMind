/**
 * Ensambla Express (seguridad, CORS, logs, JSON, rutas y errores). No abre el
 * puerto, por eso las pruebas pueden importar la aplicación.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(helmet());
// Una Vercel Function admite hasta 4,5 MB por petición. El margen evita que el
// envoltorio JSON de una importación rebase el límite de la plataforma.
app.use(express.json({ limit: '3mb' }));
app.use(morgan('dev'));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'VulnMind API is running' });
});

// API Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
