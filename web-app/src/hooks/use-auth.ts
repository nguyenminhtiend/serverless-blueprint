'use client';

import { useState, useEffect, useCallback } from 'react';
import { secureStorage, type AuthUser, type AuthTokens } from '@/lib/auth/secure-storage';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface RefreshResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  refreshed: boolean;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const clearUser = useCallback(() => {
    setState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });
    secureStorage.clearTokens();
    secureStorage.clearLegacyStorage();
  }, []);

  const setUser = useCallback((user: AuthUser) => {
    setState({
      user,
      loading: false,
      error: null,
      isAuthenticated: true,
    });
  }, []);

  const loadUserFromTokens = useCallback(async () => {
    try {
      setLoading(true);

      // First check for temporary tokens from OAuth callback
      const tempTokens = secureStorage.pickupTemporaryTokens();
      if (tempTokens) {
        secureStorage.setTokens(tempTokens);
      }

      // Check if we have valid tokens
      if (!secureStorage.hasValidTokens()) {
        // Try to refresh tokens using server-side refresh token
        try {
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            const data: RefreshResponse = await refreshResponse.json();
            const tokens: AuthTokens = {
              accessToken: data.accessToken,
              idToken: data.idToken,
              expiresAt: Date.now() + data.expiresIn * 1000,
            };
            secureStorage.setTokens(tokens);
          } else {
            // No valid refresh token, user needs to login
            clearUser();
            return;
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          clearUser();
          return;
        }
      }

      // Extract user info from ID token
      const idToken = secureStorage.getIdToken();
      if (idToken) {
        const user = parseUserFromIdToken(idToken);
        if (user) {
          setUser(user);
        } else {
          clearUser();
        }
      } else {
        clearUser();
      }
    } catch (error) {
      console.error('Failed to load user from tokens:', error);
      clearUser();
    }
  }, [setUser, clearUser, setLoading]);

  const scheduleTokenRefresh = useCallback(
    (expiresAt: number) => {
      const now = Date.now();
      const refreshTime = expiresAt - TOKEN_REFRESH_THRESHOLD;

      if (refreshTime <= now) {
        // Token expires too soon, refresh immediately
        return;
      }

      const timeout = setTimeout(async () => {
        try {
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            const data: RefreshResponse = await refreshResponse.json();
            const tokens: AuthTokens = {
              accessToken: data.accessToken,
              idToken: data.idToken,
              expiresAt: Date.now() + data.expiresIn * 1000,
            };
            secureStorage.setTokens(tokens);

            // Update user info from new ID token
            const user = parseUserFromIdToken(data.idToken);
            if (user) {
              setUser(user);
              scheduleTokenRefresh(tokens.expiresAt);
            }
          } else {
            clearUser();
          }
        } catch (error) {
          console.error('Automatic token refresh failed:', error);
          clearUser();
        }
      }, refreshTime - now);

      return () => clearTimeout(timeout);
    },
    [setUser, clearUser],
  );

  useEffect(() => {
    loadUserFromTokens();
  }, [loadUserFromTokens]);

  useEffect(() => {
    if (state.isAuthenticated) {
      const expiresAt = secureStorage.getExpiresAt();
      if (expiresAt > 0) {
        const cleanup = scheduleTokenRefresh(expiresAt);
        return cleanup;
      }
    }
  }, [state.isAuthenticated, scheduleTokenRefresh]);

  const signIn = useCallback(async (returnTo?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Redirect to OAuth login API route
      const loginUrl = new URL('/api/auth/login', window.location.origin);
      if (returnTo) {
        loginUrl.searchParams.set('returnTo', returnTo);
      }

      window.location.href = loginUrl.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  }, [setError, setLoading]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Redirect to logout API route which will handle Cognito logout
      window.location.href = '/api/auth/logout';
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout failed:', error);
      clearUser();
    }
  }, [clearUser]);

  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        const data: RefreshResponse = await refreshResponse.json();
        const tokens: AuthTokens = {
          accessToken: data.accessToken,
          idToken: data.idToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };
        secureStorage.setTokens(tokens);

        const user = parseUserFromIdToken(data.idToken);
        if (user) {
          setUser(user);
        }
      } else {
        clearUser();
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      clearUser();
      throw error;
    }
  }, [setUser, clearUser]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: state.isAuthenticated,
    accessToken: secureStorage.getAccessToken(),
    signIn,
    signOut,
    refreshToken,
    clearError: () => setError(null),
  };
}

/**
 * Parses user information from ID token
 */
function parseUserFromIdToken(idToken: string): AuthUser | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    const payload = JSON.parse(jsonPayload);

    return {
      email: payload.email || '',
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      emailVerified: payload.email_verified === true,
    };
  } catch (error) {
    console.error('Failed to parse ID token:', error);
    return null;
  }
}
