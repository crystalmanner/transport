import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { authenticate, requireAuth, requireRole } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import driverRouter from './routes/driver.js';
import guardRouter from './routes/guard.js';
import healthRouter from './routes/health.js';
import pointsRouter from './routes/points.js';
import publicRouter from './routes/public.js';
import userRouter from './routes/user.js';
import warehouseRouter from './routes/warehouse.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use('/api', authenticate);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/points', requireAuth, pointsRouter);
app.use('/api/user', requireAuth, userRouter);
app.use('/api/guard', guardRouter);
app.use('/api/driver', driverRouter);
app.use('/api/warehouse', warehouseRouter);
app.use('/api/admin', requireRole('admin'), adminRouter);
app.use('/api', publicRouter);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Production only: Express serves the built React app. In dev, Vite serves it and proxies /api here.
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Database errors that mean "the request was wrong", not "the server is broken".
const DB_ERRORS = {
  ER_NO_REFERENCED_ROW_2: [400, 'One of the selected items no longer exists. Please refresh and try again.'],
  ER_ROW_IS_REFERENCED_2: [409, 'This item is still used by other records, so it cannot be deleted.'],
  ER_DUP_ENTRY: [409, 'An item with the same name or number already exists.'],
};

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'The request could not be read.' });
  }
  if (DB_ERRORS[err.code]) {
    const [status, message] = DB_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
