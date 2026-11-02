export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
}

const clientRequestCounts = new Map<string, { count: number; resetTime: number }>();
let requestsSinceCleanup = 0;

export function createRateLimiter(options: RateLimitOptions) {
  return (req: any, res: any, next: any) => {
    // Express req.ip respects the explicitly configured trust-proxy policy.
    // Do not read X-Forwarded-For directly: clients can spoof that header.
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown-client');
    const now = Date.now();

    requestsSinceCleanup++;
    if (requestsSinceCleanup >= 256 || clientRequestCounts.size > 10000) {
      requestsSinceCleanup = 0;
      for (const [key, value] of clientRequestCounts) {
        if (now > value.resetTime || clientRequestCounts.size > 8000) {
          clientRequestCounts.delete(key);
        }
      }
    }

    const record = clientRequestCounts.get(ip);
    if (!record || now > record.resetTime) {
      clientRequestCounts.set(ip, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    record.count++;
    if (record.count > options.maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: options.message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

export const publicSearchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Search query rate limit reached. Please wait a moment before trying again.',
});

export const contributionLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: 'Contribution submission limit reached to prevent automated spam. Please try again later.',
});

// Slow down password guessing against the single-owner administrator account.
export const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many administrator login attempts. Please wait 15 minutes before trying again.',
});

// Limit creation of anonymous tracking sessions to reduce session-flood abuse.
export const trackingSessionLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many journey sessions were started from this connection. Please try again later.',
});
