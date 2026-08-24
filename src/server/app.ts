import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import { initDatabase } from './db/database';
import { seedDatabase } from './db/seed';
import { startBackgroundWorker } from './services/backgroundWorker';

import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import doctorRoutes from './routes/doctorRoutes';
import adminRoutes from './routes/adminRoutes';
import systemRoutes from './routes/systemRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database & seed sample records
initDatabase();
seedDatabase();

// Start Background Worker for medication reminders & retries
startBackgroundWorker(15000); // 15-second cycles for responsive testing

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/system', systemRoutes);

// In production, serve frontend client build
const clientDistPath = path.resolve(__dirname, '../../dist/client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` ClinicPulse Healthcare Manager Server Ready!`);
    console.log(` Port: http://localhost:${PORT}`);
    console.log(` Background worker active with auto-retries & reminders`);
    console.log(`====================================================`);
  });
}

export default app;
