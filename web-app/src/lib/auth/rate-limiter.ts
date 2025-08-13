/**
 * Simple in-memory rate limiter for authentication endpoints
 * Provides protection against brute force attacks and abuse
 */

import { authLogger, AuthEventType } from './auth-logger';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Block duration after limit exceeded (ms) */
  blockDurationMs: number;
}

/**
 * Rate limit entry for tracking requests
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

/**
 * Rate limiter configurations for different endpoints
 */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxRequests: parseInt(process.env.AUTH_LOGIN_RATE_LIMIT || '10', 10),
    windowMs: parseInt(process.env.AUTH_LOGIN_RATE_WINDOW_MS || '900000', 10), // 15 minutes
    blockDurationMs: parseInt(process.env.AUTH_LOGIN_BLOCK_DURATION_MS || '3600000', 10), // 1 hour
  },
  callback: {
    maxRequests: parseInt(process.env.AUTH_CALLBACK_RATE_LIMIT || '20', 10),
    windowMs: parseInt(process.env.AUTH_CALLBACK_RATE_WINDOW_MS || '300000', 10), // 5 minutes
    blockDurationMs: parseInt(process.env.AUTH_CALLBACK_BLOCK_DURATION_MS || '1800000', 10), // 30 minutes
  },
  refresh: {
    maxRequests: parseInt(process.env.AUTH_REFRESH_RATE_LIMIT || '30', 10),
    windowMs: parseInt(process.env.AUTH_REFRESH_RATE_WINDOW_MS || '300000', 10), // 5 minutes
    blockDurationMs: parseInt(process.env.AUTH_REFRESH_BLOCK_DURATION_MS || '900000', 10), // 15 minutes
  },
};

/**
 * In-memory storage for rate limit data
 * Note: In production, consider using Redis or similar for distributed systems
 */
const rateLimitStorage = new Map<string, RateLimitEntry>();

/**
 * Extracts client identifier from request
 */
function getClientIdentifier(request: {
  headers: { get: (name: string) => string | null };
}): string {
  // Try to get real IP from various headers (depending on your deployment)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    forwardedFor?.split(',')[0]?.trim() ||
    realIP ||
    'unknown';

  // Include user agent for additional fingerprinting
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const fingerprint = `${remoteAddr}:${userAgent.slice(0, 100)}`;

  return Buffer.from(fingerprint).toString('base64').slice(0, 32);
}

/**
 * Checks if request should be rate limited
 */
export function checkRateLimit(
  endpoint: keyof typeof RATE_LIMIT_CONFIGS,
  request: { headers: { get: (name: string) => string | null } },
): { allowed: boolean; retryAfter?: number; remaining?: number } {
  // Skip rate limiting in development if disabled
  if (process.env.NODE_ENV === 'development' && process.env.AUTH_DISABLE_RATE_LIMITING === 'true') {
    return { allowed: true };
  }

  const config = RATE_LIMIT_CONFIGS[endpoint];
  if (!config) {
    // Allow if no config found
    return { allowed: true };
  }

  const clientId = getClientIdentifier(request);
  const key = `${endpoint}:${clientId}`;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStorage.get(key);
  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      blocked: false,
    };
    rateLimitStorage.set(key, entry);
  }

  // Check if client is currently blocked
  if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
    const retryAfter = Math.ceil((entry.blockUntil - now) / 1000);

    authLogger.warn(AuthEventType.SECURITY_VIOLATION, 'Rate limit block in effect', {
      endpoint,
      clientId: clientId.slice(0, 8) + '...',
      retryAfter,
    });

    return { allowed: false, retryAfter };
  }

  // Reset window if expired
  if (now >= entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + config.windowMs;
    entry.blocked = false;
    entry.blockUntil = undefined;
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockUntil = now + config.blockDurationMs;

    const retryAfter = Math.ceil(config.blockDurationMs / 1000);

    authLogger.error(
      AuthEventType.SECURITY_VIOLATION,
      'Rate limit exceeded - client blocked',
      undefined,
      {
        endpoint,
        clientId: clientId.slice(0, 8) + '...',
        requestCount: entry.count,
        maxRequests: config.maxRequests,
        blockDuration: config.blockDurationMs,
      },
    );

    return { allowed: false, retryAfter };
  }

  const remaining = config.maxRequests - entry.count;

  // Log warning when approaching limit
  if (remaining <= 2) {
    authLogger.warn(AuthEventType.SECURITY_VIOLATION, 'Rate limit warning - approaching limit', {
      endpoint,
      clientId: clientId.slice(0, 8) + '...',
      remaining,
      requestCount: entry.count,
    });
  }

  return { allowed: true, remaining };
}

/**
 * Middleware to check rate limits for authentication endpoints
 */
export function rateLimitMiddleware(endpoint: keyof typeof RATE_LIMIT_CONFIGS) {
  return (request: { headers: { get: (name: string) => string | null } }) => {
    const result = checkRateLimit(endpoint, request);

    if (!result.allowed) {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      (error as any).retryAfter = result.retryAfter;
      throw error;
    }

    return result;
  };
}

/**
 * Cleans up expired rate limit entries (call periodically)
 */
export function cleanupRateLimitStorage(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of rateLimitStorage.entries()) {
    // Remove entries that are past their block time and reset time
    const isExpired = now >= entry.resetTime && (!entry.blockUntil || now >= entry.blockUntil);

    if (isExpired) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => rateLimitStorage.delete(key));

  if (keysToDelete.length > 0) {
    authLogger.debug(
      AuthEventType.SESSION_EXPIRED,
      `Cleaned up ${keysToDelete.length} expired rate limit entries`,
    );
  }
}

/**
 * Gets current rate limit status for a client and endpoint
 */
export function getRateLimitStatus(
  endpoint: keyof typeof RATE_LIMIT_CONFIGS,
  request: { headers: { get: (name: string) => string | null } },
): {
  remaining: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
} {
  const config = RATE_LIMIT_CONFIGS[endpoint];
  const clientId = getClientIdentifier(request);
  const key = `${endpoint}:${clientId}`;
  const entry = rateLimitStorage.get(key);

  if (!entry) {
    return {
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      blocked: false,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
    blocked: entry.blocked,
    blockUntil: entry.blockUntil,
  };
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStorage, 5 * 60 * 1000);
}
