import crypto from 'crypto';

export interface AdminSession {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
}

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

export class AdminAuthService {
  private static sessions: Map<string, AdminSession> = new Map();
  private static loginAttempts: Map<string, LoginAttempt> = new Map();
  private static readonly SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Constant-time string equality check to prevent timing attacks
   */
  private static timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) {
      // Execute dummy comparison to prevent length timing leaks
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Authenticate administrator and issue expiring session token
   */
  public static login(
    username?: string,
    password?: string,
    clientIp: string = 'unknown'
  ): { success: boolean; token?: string; error?: string; retryAfterSeconds?: number } {
    const now = Date.now();

    // 1. Rate limiting check
    const attempt = this.loginAttempts.get(clientIp);
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > now) {
      const retryAfter = Math.ceil((attempt.lockedUntil - now) / 1000);
      return {
        success: false,
        error: `Too many failed login attempts. Locked out for ${retryAfter} seconds.`,
        retryAfterSeconds: retryAfter
      };
    }

    // 2. Validate input existence
    if (!username || !password) {
      this.recordFailedAttempt(clientIp);
      return { success: false, error: 'Administrator username and password are required' };
    }

    // 3. Resolve configured credentials
    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const configuredSecret = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY;

    if (!configuredSecret) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          error: 'Administrator authentication is disabled. ADMIN_PASSWORD environment variable must be configured.'
        };
      }
      // In local dev/test without explicit env, reject arbitrary strings
      return {
        success: false,
        error: 'ADMIN_PASSWORD environment variable is not configured. Set ADMIN_PASSWORD in your environment.'
      };
    }

    // 4. Verify username and password
    const isUserValid = this.timingSafeCompare(username.trim(), expectedUsername);
    const isPassValid = this.timingSafeCompare(password, configuredSecret);

    if (!isUserValid || !isPassValid) {
      this.recordFailedAttempt(clientIp);
      return { success: false, error: 'Invalid administrator credentials' };
    }

    // 5. Successful authentication -> Reset rate limit and generate token
    this.loginAttempts.delete(clientIp);
    const token = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      token,
      username: expectedUsername,
      createdAt: now,
      expiresAt: now + this.SESSION_TTL_MS,
      lastAccessedAt: now
    };

    this.sessions.set(token, session);
    return { success: true, token };
  }

  /**
   * Validate session token from Authorization: Bearer <token>
   */
  public static validateSession(token: string): { valid: boolean; session?: AdminSession; error?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Authentication token required' };
    }

    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false, error: 'Invalid administrator token' };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, error: 'Administrator session expired' };
    }

    // Sliding window last access update
    session.lastAccessedAt = now;
    return { valid: true, session };
  }

  /**
   * Revoke session on logout
   */
  public static logout(token: string): boolean {
    if (!token) return false;
    return this.sessions.delete(token);
  }

  /**
   * Record failed login attempt for rate limiting
   */
  private static recordFailedAttempt(clientIp: string) {
    const now = Date.now();
    const attempt = this.loginAttempts.get(clientIp) || { count: 0, firstAttemptAt: now };

    // Reset window if older than lockout window
    if (now - attempt.firstAttemptAt > this.LOCKOUT_WINDOW_MS) {
      attempt.count = 1;
      attempt.firstAttemptAt = now;
      attempt.lockedUntil = undefined;
    } else {
      attempt.count++;
    }

    if (attempt.count >= this.MAX_FAILED_ATTEMPTS) {
      attempt.lockedUntil = now + this.LOCKOUT_WINDOW_MS;
    }

    this.loginAttempts.set(clientIp, attempt);
  }

  /**
   * Helper for tests to clean state
   */
  public static clearAllSessions(): void {
    this.sessions.clear();
    this.loginAttempts.clear();
  }
}
