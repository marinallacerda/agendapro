import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './database';
import authRouter from './routes/auth';
import servicesRouter from './routes/services';
import scheduleRouter from './routes/schedule';
import appointmentsRouter from './routes/appointments';
import settingsRouter from './routes/settings';
import publicRouter from './routes/public';
import clientsRouter from './routes/clients';
import professionalsRouter from './routes/professionals';
import reportsRouter from './routes/reports';
import { startCronJobs } from './utils/cron';

dotenv.config();

const PORT = process.env.PORT || 3001;

(async () => {
  await initDatabase();

  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/professionals', professionalsRouter);
  app.use('/api/reports', reportsRouter);

  if (process.env.NODE_ENV === 'production') {
    const staticPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(staticPath));
    app.get('*', (_req, res) => res.sendFile(path.join(staticPath, 'index.html')));
  }

  startCronJobs();

  app.listen(PORT, () => {
    console.log(`\n✅ AgendaPro rodando em http://localhost:${PORT}`);
    console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
  });
})();
