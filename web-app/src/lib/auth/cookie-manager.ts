/**
 * Secure cookie management for authentication tokens
 * Implements secure, HttpOnly cookies for refresh token storage with proper configuration
 */

import { cookies } from 'next/headers';

/**
 * Cookie configuration with environment-aware settings
 */
export const COOKIE_CONFIG = {
  /** Refresh token cookie name */
  REFRESH_TOKEN: process.env.AUTH_REFRESH_TOKEN_COOKIE_NAME || 'auth_refresh_token',
  /** Session ID cookie name */
  SESSION_ID: process.env.AUTH_SESSION_COOKIE_NAME || 'auth_session_id',
  /** Maximum age in seconds (default: 30 days) */
  MAX_AGE: parseInt(process.env.AUTH_REFRESH_TOKEN_MAX_AGE || '2592000', 10),
  /** Secure flag - always true in production */
  SECURE: process.env.NODE_ENV === 'production' || process.env.AUTH_FORCE_SECURE_COOKIES === 'true',
  /** SameSite policy */
  SAME_SITE: (process.env.AUTH_COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax',
  /** HttpOnly flag for security */
  HTTP_ONLY: true,
  /** Cookie path */
  PATH: process.env.AUTH_COOKIE_PATH || '/',
  /** Cookie domain (optional) */
  DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
} as const;

/**
 * Cookie options for secure token storage
 * @param maxAge - Optional maximum age in seconds
 * @returns Cookie options object with security settings
 */
const getSecureCookieOptions = (maxAge?: number) => {
  const options: Record<string, any> = {
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    secure: COOKIE_CONFIG.SECURE,
    sameSite: COOKIE_CONFIG.SAME_SITE,
    maxAge: maxAge || COOKIE_CONFIG.MAX_AGE,
    path: COOKIE_CONFIG.PATH,
  };

  // Add domain if configured
  if (COOKIE_CONFIG.DOMAIN) {
    options.domain = COOKIE_CONFIG.DOMAIN;
  }

  return options;
};

/**
 * Sets refresh token in secure HttpOnly cookie
 * @param refreshToken The refresh token to store
 * @param expiresIn Optional expiration time in seconds
 */
export async function setRefreshTokenCookie(
  refreshToken: string,
  expiresIn?: number,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, refreshToken, getSecureCookieOptions(expiresIn));
}

/**
 * Gets refresh token from secure cookie
 * @returns Refresh token or null if not found
 */
export async function getRefreshTokenCookie(): Promise<string | null> {
  const cookieStore = await cookies();

  try {
    const cookie = cookieStore.get(COOKIE_CONFIG.REFRESH_TOKEN);
    return cookie?.value || null;
  } catch (error) {
    console.error('Failed to retrieve refresh token cookie:', error);
    return null;
  }
}

/**
 * Clears refresh token cookie
 */
export async function clearRefreshTokenCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, '', {
    ...getSecureCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Sets session ID cookie for tracking user sessions
 * @param sessionId Unique session identifier
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_CONFIG.SESSION_ID, sessionId, getSecureCookieOptions());
}

/**
 * Gets session ID from cookie
 * @returns Session ID or null if not found
 */
export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();

  try {
    const cookie = cookieStore.get(COOKIE_CONFIG.SESSION_ID);
    return cookie?.value || null;
  } catch (error) {
    console.error('Failed to retrieve session cookie:', error);
    return null;
  }
}

/**
 * Clears session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_CONFIG.SESSION_ID, '', {
    ...getSecureCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Clears all authentication cookies
 */
export async function clearAllAuthCookies(): Promise<void> {
  await clearRefreshTokenCookie();
  await clearSessionCookie();
}

/**
 * Validates that cookies are properly configured
 * @returns True if cookie configuration is secure
 */
export function validateCookieConfig(): boolean {
  if (process.env.NODE_ENV === 'production' && !COOKIE_CONFIG.SECURE) {
    console.warn('Cookies should be secure in production');
    return false;
  }

  if (!COOKIE_CONFIG.HTTP_ONLY) {
    console.warn('Refresh token cookies should be HttpOnly');
    return false;
  }

  return true;
}

/**
 * Generates a secure session ID
 * @returns Random session identifier
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}
