/**
 * Secure cookie management for authentication tokens
 * Implements secure, HttpOnly cookies for refresh token storage
 */

import { cookies } from 'next/headers';

/**
 * Cookie configuration constants
 */
export const COOKIE_CONFIG = {
  REFRESH_TOKEN: 'auth_refresh_token',
  SESSION_ID: 'auth_session_id',
  MAX_AGE: 30 * 24 * 60 * 60, // 30 days in seconds
  SECURE: process.env.NODE_ENV === 'production',
  SAME_SITE: 'lax' as const,
  HTTP_ONLY: true,
  PATH: '/',
};

/**
 * Cookie options for secure token storage
 */
const getSecureCookieOptions = (maxAge?: number) => ({
  httpOnly: COOKIE_CONFIG.HTTP_ONLY,
  secure: COOKIE_CONFIG.SECURE,
  sameSite: COOKIE_CONFIG.SAME_SITE,
  maxAge: maxAge || COOKIE_CONFIG.MAX_AGE,
  path: COOKIE_CONFIG.PATH,
});

/**
 * Sets refresh token in secure HttpOnly cookie
 * @param refreshToken The refresh token to store
 * @param expiresIn Optional expiration time in seconds
 */
export function setRefreshTokenCookie(refreshToken: string, expiresIn?: number): void {
  const cookieStore = cookies();

  cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, refreshToken, getSecureCookieOptions(expiresIn));
}

/**
 * Gets refresh token from secure cookie
 * @returns Refresh token or null if not found
 */
export function getRefreshTokenCookie(): string | null {
  const cookieStore = cookies();

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
export function clearRefreshTokenCookie(): void {
  const cookieStore = cookies();

  cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, '', {
    ...getSecureCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Sets session ID cookie for tracking user sessions
 * @param sessionId Unique session identifier
 */
export function setSessionCookie(sessionId: string): void {
  const cookieStore = cookies();

  cookieStore.set(COOKIE_CONFIG.SESSION_ID, sessionId, getSecureCookieOptions());
}

/**
 * Gets session ID from cookie
 * @returns Session ID or null if not found
 */
export function getSessionCookie(): string | null {
  const cookieStore = cookies();

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
export function clearSessionCookie(): void {
  const cookieStore = cookies();

  cookieStore.set(COOKIE_CONFIG.SESSION_ID, '', {
    ...getSecureCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Clears all authentication cookies
 */
export function clearAllAuthCookies(): void {
  clearRefreshTokenCookie();
  clearSessionCookie();
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
