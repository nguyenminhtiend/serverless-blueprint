/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 Authorization Code flow
 * Implements RFC 7636 with S256 code challenge method
 */

/**
 * Generates a cryptographically secure random string for use as code verifier
 * @param length Length of the code verifier (43-128 characters per RFC 7636)
 * @returns Base64 URL-encoded random string
 */
export function generateCodeVerifier(length: number = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Creates SHA256 hash of code verifier for use as code challenge
 * @param codeVerifier The code verifier string
 * @returns Promise resolving to base64 URL-encoded SHA256 hash
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/**
 * Generates a secure random state parameter for CSRF protection
 * @param length Length of the state parameter
 * @returns Base64 URL-encoded random string
 */
export function generateState(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Encodes data as base64 URL-safe string (without padding)
 * @param data Uint8Array to encode
 * @returns Base64 URL-encoded string
 */
function base64URLEncode(data: Uint8Array): string {
  if (typeof btoa === 'undefined') {
    // Node.js environment
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  // Browser environment
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * PKCE session data stored temporarily during OAuth flow
 */
export interface PKCESession {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  redirectUri: string;
  timestamp: number;
}

/**
 * Creates a complete PKCE session with all required parameters
 * @param redirectUri The redirect URI for OAuth callback
 * @returns Promise resolving to PKCE session data
 */
export async function createPKCESession(redirectUri: string): Promise<PKCESession> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  return {
    codeVerifier,
    codeChallenge,
    state,
    redirectUri,
    timestamp: Date.now(),
  };
}

/**
 * Validates that a PKCE session is still valid (not expired)
 * @param session PKCE session to validate
 * @param maxAgeMs Maximum age in milliseconds (default: 10 minutes)
 * @returns True if session is valid
 */
export function isValidPKCESession(
  session: PKCESession,
  maxAgeMs: number = 10 * 60 * 1000,
): boolean {
  return Date.now() - session.timestamp < maxAgeMs;
}

/**
 * Storage keys for PKCE session data
 * Note: PKCE sessions are now primarily handled server-side via secure cookies
 */
export const PKCE_STORAGE_KEYS = {
  SESSION: 'pkce_session',
} as const;

/**
 * Stores PKCE session in sessionStorage (legacy client-side support)
 * @param session PKCE session data
 * @deprecated Server-side PKCE session handling is preferred
 */
export function storePKCESession(session: PKCESession): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.setItem(PKCE_STORAGE_KEYS.SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to store PKCE session:', error);
  }
}

/**
 * Retrieves PKCE session from sessionStorage (legacy client-side support)
 * @returns PKCE session or null if not found/invalid
 * @deprecated Server-side PKCE session handling is preferred
 */
export function retrievePKCESession(): PKCESession | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(PKCE_STORAGE_KEYS.SESSION);
    if (!stored) return null;

    const session: PKCESession = JSON.parse(stored);

    // Validate session structure
    if (!session.codeVerifier || !session.codeChallenge || !session.state || !session.redirectUri) {
      clearPKCESession();
      return null;
    }

    // Check if session is still valid
    if (!isValidPKCESession(session)) {
      clearPKCESession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to retrieve PKCE session:', error);
    clearPKCESession();
    return null;
  }
}

/**
 * Clears PKCE session from sessionStorage
 */
export function clearPKCESession(): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.removeItem(PKCE_STORAGE_KEYS.SESSION);
  } catch (error) {
    console.error('Failed to clear PKCE session:', error);
  }
}
