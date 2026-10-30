import express, { Request, Response, NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from './config.js';
import { repository } from './db/repository.js';
import { installRepositoryPersistence, isRepositoryPersistenceReady } from './db/persistence.js';
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

  // Health checks also verify that the persistent state file is writable.
  const healthHandler = (_req: Request, res: Response) => {
    const storageReady = isRepositoryPersistenceReady();
    res.status(storageReady ? 200 : 503).json({
      status: storageReady ? 'UP' : 'DEGRADED',
      storageReady,
      storageMode: 'JSON_FILE',
      service: 'YatriBus Backend API',
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Mount API routers
  app.use('/api/places', placesRouter);
  app.use('/api/routes', routesRouter);
  app.use('/api/buses', busesRouter);
  app.use('/api/tracking', trackingRouter);
  app.use('/api/contributions', contributionsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/operators', operatorsRouter);

  // Serve the built passenger app and API from one HTTPS host/container.
  const webDist = resolve(process.cwd(), 'dist');
  const webIndex = resolve(webDist, 'index.html');
  if (existsSync(webIndex)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/') && req.path !== '/health') {
        return res.sendFile(webIndex);
      }
      next();
    });
  }

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
