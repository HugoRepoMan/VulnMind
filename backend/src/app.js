import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
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
