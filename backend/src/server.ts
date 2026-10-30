import express, { Request, Response, NextFunction } from 'express';
import { CONFIG } from './config.js';
import { repository } from './db/repository.js';
import { installRepositoryPersistence } from './db/persistence.js';
import { placesRouter } from './routes/places.js';
import { routesRouter } from './routes/routes.js';
import { busesRouter } from './routes/buses.js';
import { trackingRouter } from './routes/tracking.js';
import { contributionsRouter } from './routes/contributions.js';
import { adminRouter } from './routes/admin.js';
import { operatorsRouter } from './routes/operators.js';

export function createServer() {
  installRepositoryPersistence();
  repository.ensureSuperAdmin(CONFIG.ADMIN_EMAIL);
  const app = express();

  // Basic security and parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health checks
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'YatriBus Backend API',
      timestamp: new Date().toISOString(),
      costTarget: '₹0 Initial Architecture',
    });
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'YatriBus Backend API',
      timestamp: new Date().toISOString(),
      costTarget: '₹0 Initial Architecture',
    });
  });

  // Mount API routers
  app.use('/api/places', placesRouter);
  app.use('/api/routes', routesRouter);
  app.use('/api/buses', busesRouter);
  app.use('/api/tracking', trackingRouter);
  app.use('/api/contributions', contributionsRouter);
  app.use('/api/operators', operatorsRouter);
  app.use('/api/admin', adminRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint Not Found', path: req.path });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Unexpected backend exception',
    });
  });

  return app;
}

export const app = createServer();

if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚌 YatriBus Backend API listening on port ${CONFIG.PORT}`);
    // eslint-disable-next-line no-console
    console.log(`📍 Environment: ${CONFIG.NODE_ENV} | Primary Market: India`);
  });
}
