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
import { indiaCatalogueRouter } from './routes/indiaCatalogue.js';
import { timetableRouter } from './routes/timetable.js';

export function createServer() {
  installRepositoryPersistence();
  repository.ensureSuperAdmin(CONFIG.ADMIN_EMAIL);
  const app = express();
  // Trust forwarded client IPs only when the deployment explicitly configures
  // the exact number of trusted reverse-proxy hops. Never trust arbitrary headers.
  app.set('trust proxy', CONFIG.TRUST_PROXY_HOPS);

  // Reduce avoidable information disclosure and browser-side attack surface.
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
    next();
  });

  // GTFS ZIP uploads have a dedicated bounded 14 MB JSON limit; all other APIs remain 1 MB.
  app.use('/api/admin/gtfs', express.json({ limit: '14mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

  // Cross-origin browser access is allow-listed. Native Capacitor HTTP and same-origin
  // requests do not require a permissive wildcard CORS policy.
  const allowedOrigins = new Set(CONFIG.CORS_ALLOWED_ORIGINS);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    res.vary('Origin');
    let sameHostOrigin = false;
    if (origin) {
      try {
        const requestOrigin = `${req.protocol}://${req.get('host')}`;
        sameHostOrigin = new URL(origin).origin === new URL(requestOrigin).origin;
      } catch {
        return res.status(403).json({ error: 'Origin not allowed.' });
      }
    }
    if (origin && !sameHostOrigin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Origin not allowed.' });
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Health checks also verify that the persistent state file is writable.
  const healthHandler = (_req: Request, res: Response) => {
    const storageReady = isRepositoryPersistenceReady();
    const [adminSalt, adminHash, adminHashExtra] = CONFIG.ADMIN_PASSWORD_HASH.split(':');
    const adminAuthReady = Boolean(
      CONFIG.ADMIN_EMAIL && adminSalt && adminHashExtra === undefined &&
      /^[a-f0-9]{128}$/i.test(adminHash || '') && CONFIG.ADMIN_JWT_SECRET.length >= 32
    );
    const productionConfigReady = CONFIG.NODE_ENV !== 'production' || adminAuthReady;
    const serviceReady = storageReady && productionConfigReady;
    res.status(serviceReady ? 200 : 503).json({
      status: serviceReady ? 'UP' : 'DEGRADED',
      storageReady,
      adminAuthReady,
      productionConfigReady,
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
  app.use('/api/india/catalogue', indiaCatalogueRouter);
  app.use('/api/timetable', timetableRouter);

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

  // Never send internal exception messages, file paths or stack details to clients.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500
      ? err.status
      : 500;
    if (status === 413) {
      return res.status(413).json({ error: 'Request body exceeds the endpoint upload limit (GTFS import: 14 MB; other APIs: 1 MB).' });
    }
    if (status === 400) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

export const app = createServer();

if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, () => {
    console.log(`YatriBus Backend API listening on port ${CONFIG.PORT}`);
    console.log(`Environment: ${CONFIG.NODE_ENV} | Primary Market: India`);
  });
}
