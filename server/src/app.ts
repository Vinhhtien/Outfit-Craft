import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { env } from './config/env.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
// Thumbnail dataURL tu canvas co the kha nang -> noi gioi han body.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv === 'development') app.use(morgan('dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Ban gui qua nhieu request, thu lai sau' },
  })
);

app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'OutfitCraft API dang chay', time: new Date() })
);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
