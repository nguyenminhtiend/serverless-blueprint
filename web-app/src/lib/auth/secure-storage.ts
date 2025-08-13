/**
 * Simplified secure storage for OAuth tokens (access tokens only)
 * Refresh tokens are now handled server-side via HttpOnly cookies
 */

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  expiresAt: number;
}

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

class SecureStorage {
  private accessToken: string | null = null;
  private idToken: string | null = null;
  private expiresAt: number = 0;

  /**
   * Sets access token and ID token in memory only
   * No persistent storage - tokens are lost on page refresh (by design)
   */
  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.idToken = tokens.idToken;
    this.expiresAt = tokens.expiresAt;
  }

  /**
   * Gets current access token if not expired
   */
  getAccessToken(): string | null {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      return null;
    }
    return this.accessToken;
  }

  /**
   * Gets current ID token if not expired
   */
  getIdToken(): string | null {
    if (!this.idToken || Date.now() >= this.expiresAt) {
      return null;
    }
    return this.idToken;
  }

  /**
   * Checks if tokens are available and not expired
   */
  hasValidTokens(): boolean {
    return !!(this.accessToken && this.idToken && Date.now() < this.expiresAt);
  }

  /**
   * Gets token expiration time
   */
  getExpiresAt(): number {
    return this.expiresAt;
  }

  /**
   * Clears all tokens from memory
   */
  clearTokens(): void {
    this.accessToken = null;
    this.idToken = null;
    this.expiresAt = 0;
  }

  /**
   * Picks up temporary tokens from cookies (set by OAuth callback)
   * These are short-lived cookies that client picks up once
   */
  pickupTemporaryTokens(): AuthTokens | null {
    try {
      if (typeof window === 'undefined') return null;

      const accessToken = this.getCookie('access_token_temp');
      const idToken = this.getCookie('id_token_temp');

      if (!accessToken || !idToken) {
        return null;
      }

      // Clear the temporary cookies immediately
      this.clearCookie('access_token_temp');
      this.clearCookie('id_token_temp');

      // Decode ID token to get expiration (basic parsing, no verification needed here)
      const payload = this.parseJWTPayload(accessToken);
      const exp = payload?.exp;
      const expiresAt = typeof exp === 'number' ? exp * 1000 : Date.now() + 3600000; // 1 hour fallback

      return {
        accessToken,
        idToken,
        expiresAt,
      };
    } catch (error) {
      console.error('Failed to pickup temporary tokens:', error);
      return null;
    }
  }

  /**
   * Helper to get cookie value
   */
  private getCookie(name: string): string | null {
    if (typeof window === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  /**
   * Helper to clear a cookie
   */
  private clearCookie(name: string): void {
    if (typeof window === 'undefined') return;

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  /**
   * Basic JWT payload parsing (no verification)
   */
  private parseJWTPayload(token: string): Record<string, unknown> | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Legacy cleanup - removes old encrypted storage
   */
  clearLegacyStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage && window.localStorage) {
        window.sessionStorage.removeItem('auth_enc_data');
        window.localStorage.removeItem('auth_user');
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}

export const secureStorage = new SecureStorage();
