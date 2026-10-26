import http from 'http';
import { parse as parseUrl } from 'url';
import { ApiHandler } from './routes/api';
import { OperatorClaimService } from './services/operatorClaimService';
import { initDatabase } from './db/db';
import { AdminAuthService } from './services/adminAuthService';

const PORT = process.env.PORT || 3000;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function requireAdminAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid administrator Bearer token required' }));
    return false;
  }

  const token = authHeader.substring(7).trim();
  const authResult = AdminAuthService.validateSession(token);
  if (!authResult.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: authResult.error || 'Invalid or expired administrator token' }));
    return false;
  }

  return true;
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = parseUrl(req.url || '', true);
  const pathname = parsed.pathname || '';
  const query = parsed.query;

  try {
    // 1. Health check
    if (pathname === '/api/v1/health' && req.method === 'GET') {
      const response = await ApiHandler.getHealth();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 2. Places search
    if (pathname === '/api/v1/places/search' && req.method === 'GET') {
      const q = (query.q as string) || '';
      const limit = query.limit ? parseInt(query.limit as string) : 8;
      const response = await ApiHandler.searchPlaces(q, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 3. Nearby places
    if (pathname === '/api/v1/places/nearby' && req.method === 'GET') {
      const lat = parseFloat(query.lat as string);
      const lng = parseFloat(query.lng as string);
      const radiusKm = query.radiusKm ? parseFloat(query.radiusKm as string) : 5;
      const response = await ApiHandler.getNearbyPlaces(lat, lng, radiusKm);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 4. Place by ID
    const placeMatch = pathname.match(/^\/api\/v1\/places\/([a-zA-Z0-9_-]+)$/);
    if (placeMatch && req.method === 'GET') {
      const id = placeMatch[1];
      const response = await ApiHandler.getPlaceById(id);
      res.writeHead(response.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 4.5. All Routes
    if (pathname === '/api/v1/routes' && req.method === 'GET') {
      const response = await ApiHandler.getAllRoutes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 5. Routes search
    if (pathname === '/api/v1/routes/search' && req.method === 'GET') {
      const origin = (query.origin as string) || '';
      const destination = (query.destination as string) || '';
      const response = await ApiHandler.searchRoutes(origin, destination);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 6. Timetables by route
    const ttMatch = pathname.match(/^\/api\/v1\/routes\/([a-zA-Z0-9_-]+)\/timetables$/);
    if (ttMatch && req.method === 'GET') {
      const routeId = ttMatch[1];
      const response = await ApiHandler.getTimetables(routeId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 7. Route by ID
    const routeMatch = pathname.match(/^\/api\/v1\/routes\/([a-zA-Z0-9_-]+)$/);
    if (routeMatch && req.method === 'GET') {
      const id = routeMatch[1];
      const response = await ApiHandler.getRouteById(id);
      res.writeHead(response.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 8. Dynamic ETA
    const etaMatch = pathname.match(/^\/api\/v1\/routes\/([a-zA-Z0-9_-]+)\/stops\/([a-zA-Z0-9_-]+)\/eta$/);
    if (etaMatch && req.method === 'GET') {
      const routeId = etaMatch[1];
      const stopId = etaMatch[2];
      const response = await ApiHandler.getETA(routeId, stopId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 9. All Buses
    if (pathname === '/api/v1/buses' && req.method === 'GET') {
      const response = await ApiHandler.getAllBuses();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 10. Bus by ID
    const busMatch = pathname.match(/^\/api\/v1\/buses\/([a-zA-Z0-9_-]+)$/);
    if (busMatch && req.method === 'GET') {
      const id = busMatch[1];
      const response = await ApiHandler.getBusById(id);
      res.writeHead(response.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 11. All Operators
    if (pathname === '/api/v1/operators' && req.method === 'GET') {
      const response = await ApiHandler.getAllOperators();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 12. Start Journey Tracking Session
    if (pathname === '/api/v1/tracking/session/start' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const response = await ApiHandler.startJourneySession(body);
      res.writeHead(response.success ? 201 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 13. Stop Journey Tracking Session
    const stopMatch = pathname.match(/^\/api\/v1\/tracking\/session\/([a-zA-Z0-9_-]+)\/stop$/);
    if (stopMatch && req.method === 'POST') {
      const sessionId = stopMatch[1];
      const response = await ApiHandler.stopJourneySession(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 14. Ingest Observation
    if (pathname === '/api/v1/tracking/observation' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const response = await ApiHandler.ingestObservation(body);
      res.writeHead(response.success ? 201 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 15. Submit Community Contribution
    if (pathname === '/api/v1/contributions' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const response = await ApiHandler.submitContribution(body);
      res.writeHead(response.success ? 201 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 16. Contribution Status Lookup
    const subMatch = pathname.match(/^\/api\/v1\/contributions\/([a-zA-Z0-9_-]+)$/);
    if (subMatch && req.method === 'GET') {
      const id = subMatch[1];
      const response = await ApiHandler.getContributionStatus(id);
      res.writeHead(response.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 16.5. Admin Login
    if (pathname === '/api/v1/admin/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const response = await ApiHandler.adminLogin(body.username, body.password, clientIp);
      const statusCode = response.success ? 200 : (response.meta?.retryAfterSeconds ? 429 : 401);
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 16.6. Admin Logout
    if (pathname === '/api/v1/admin/logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
      const response = ApiHandler.adminLogout(token);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 17. Admin Submissions Queue (Protected)
    if (pathname === '/api/v1/admin/submissions' && req.method === 'GET') {
      if (!requireAdminAuth(req, res)) return;
      const status = query.status as string;
      const response = await ApiHandler.getAdminSubmissions(status);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 18. Admin Review Submission (Protected)
    const reviewMatch = pathname.match(/^\/api\/v1\/admin\/submissions\/([a-zA-Z0-9_-]+)\/review$/);
    if (reviewMatch && req.method === 'POST') {
      if (!requireAdminAuth(req, res)) return;
      const id = reviewMatch[1];
      const body = await parseJsonBody(req);
      const response = await ApiHandler.reviewSubmission(id, body.action, body.remarks);
      res.writeHead(response.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 19. Admin Audit Logs (Protected)
    if (pathname === '/api/v1/admin/audit-logs' && req.method === 'GET') {
      if (!requireAdminAuth(req, res)) return;
      const response = await ApiHandler.getAuditLogs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 20. Admin Automation Rules (Protected)
    if (pathname === '/api/v1/admin/rules' && req.method === 'GET') {
      if (!requireAdminAuth(req, res)) return;
      const response = await ApiHandler.getAutomationRules();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    const ruleMatch = pathname.match(/^\/api\/v1\/admin\/rules\/([a-zA-Z0-9_-]+)$/);
    if (ruleMatch && (req.method === 'PUT' || req.method === 'POST')) {
      if (!requireAdminAuth(req, res)) return;
      const id = ruleMatch[1];
      const body = await parseJsonBody(req);
      const response = await ApiHandler.updateAutomationRule(id, body.thresholdValue, body.isEnabled);
      res.writeHead(response.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // 21. Submit Operator Claim
    if (pathname === '/api/v1/operator/claim' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const claim = OperatorClaimService.submitClaim(
        body.operatorId,
        body.claimantName,
        body.claimantDesignation,
        body.officialPhone,
        body.officialEmail,
        body.notes
      );
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: claim }));
      return;
    }

    // 22. Get Operator Claims (Protected)
    if (pathname === '/api/v1/admin/claims' && req.method === 'GET') {
      if (!requireAdminAuth(req, res)) return;
      const status = query.status as string;
      const claims = OperatorClaimService.getAllClaims(status);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: claims }));
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
  } catch (err: any) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error' }));
  }
});

initDatabase().then((dbStatus) => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'embedded') {
      console.error('FATAL: DATABASE_URL must be configured in production mode.');
      process.exit(1);
    }
    if (dbStatus.type !== 'postgres' || !dbStatus.connected) {
      console.error('FATAL: Failed to connect to PostgreSQL database in production mode.');
      process.exit(1);
    }
  }

  server.listen(PORT, () => {
    console.log(`India Smart Bus Platform API Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database layer:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  server.listen(PORT, () => {
    console.log(`India Smart Bus Platform API Server running on port ${PORT} (fallback mode)`);
  });
});

export default server;
