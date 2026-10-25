export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
}

const clientRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function createRateLimiter(options: RateLimitOptions) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

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
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120,
  message: 'Search query rate limit reached. Please wait a moment before trying again.',
});

export const contributionLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  message: 'Contribution submission limit reached to prevent automated spam. Please try again later.',
});
