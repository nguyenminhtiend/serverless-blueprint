'use client';

import { useState, useEffect, useCallback } from 'react';
import { cognitoAuthClient } from '@/lib/auth/cognito-client';
import { secureStorage } from '@/lib/auth/secure-storage';

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
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
    });
    secureStorage.clearUser();
  }, []);

  const setUser = useCallback(async (user: AuthUser) => {
    setState({
      user,
      loading: false,
      error: null,
    });
    try {
      await secureStorage.setUser(user);
    } catch (error) {
      console.error('Failed to store user data securely:', error);
      setState((prev) => ({ ...prev, error: 'Failed to store authentication data' }));
    }
  }, []);

  const loadUserFromStorage = useCallback(async () => {
    try {
      setLoading(true);

      if (!secureStorage.isAvailable()) {
        setLoading(false);
        setError('Secure storage not available');
        return;
      }

      const user = await secureStorage.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (Date.now() >= user.expiresAt) {
        // Try to refresh token
        try {
          const refreshResult = await cognitoAuthClient.refreshToken(user.refreshToken);
          const userInfo = await cognitoAuthClient.getUser(refreshResult.accessToken);

          const updatedUser: AuthUser = {
            ...userInfo,
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            idToken: refreshResult.idToken,
            expiresAt: Date.now() + refreshResult.expiresIn * 1000,
          };

          await setUser(updatedUser);
        } catch (error) {
          // Refresh failed, clear user
          clearUser();
        }
      } else {
        // Token is still valid
        await setUser(user);
      }
    } catch (error) {
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
        const currentUser = await secureStorage.getUser();
        if (!currentUser) return;

        try {
          const refreshResult = await cognitoAuthClient.refreshToken(currentUser.refreshToken);
          const userInfo = await cognitoAuthClient.getUser(refreshResult.accessToken);

          const updatedUser: AuthUser = {
            ...userInfo,
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            idToken: refreshResult.idToken,
            expiresAt: Date.now() + refreshResult.expiresIn * 1000,
          };

          await setUser(updatedUser);
          scheduleTokenRefresh(updatedUser.expiresAt);
        } catch (error) {
          clearUser();
        }
      }, refreshTime - now);

      return () => clearTimeout(timeout);
    },
    [setUser, clearUser],
  );

  useEffect(() => {
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  useEffect(() => {
    if (state.user) {
      const cleanup = scheduleTokenRefresh(state.user.expiresAt);
      return cleanup;
    }
  }, [state.user, scheduleTokenRefresh]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const authResult = await cognitoAuthClient.signIn(email, password);
        const userInfo = await cognitoAuthClient.getUser(authResult.accessToken);

        const user: AuthUser = {
          ...userInfo,
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          idToken: authResult.idToken,
          expiresAt: Date.now() + authResult.expiresIn * 1000,
        };

        await setUser(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign in failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setUser, setError, setLoading],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ): Promise<{ requiresConfirmation: boolean; destination?: string }> => {
      try {
        setLoading(true);
        setError(null);

        const result = await cognitoAuthClient.signUp(email, password, firstName, lastName);

        setLoading(false);
        return {
          requiresConfirmation: !!result.codeDeliveryDetails,
          destination: result.codeDeliveryDetails?.destination,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign up failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setError, setLoading],
  );

  const confirmSignUp = useCallback(
    async (email: string, confirmationCode: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        await cognitoAuthClient.confirmSignUp(email, confirmationCode);
        setLoading(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Email confirmation failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setError, setLoading],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      if (state.user?.accessToken) {
        await cognitoAuthClient.signOut(state.user.accessToken);
      }
    } catch (error) {
      // Even if sign out fails on the server, clear local state
      console.error('Server sign out failed:', error);
    } finally {
      clearUser();
    }
  }, [state.user, clearUser]);

  const refreshToken = useCallback(async (): Promise<void> => {
    if (!state.user) {
      throw new Error('No user to refresh token for');
    }

    try {
      const refreshResult = await cognitoAuthClient.refreshToken(state.user.refreshToken);
      const userInfo = await cognitoAuthClient.getUser(refreshResult.accessToken);

      const updatedUser: AuthUser = {
        ...userInfo,
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        idToken: refreshResult.idToken,
        expiresAt: Date.now() + refreshResult.expiresIn * 1000,
      };

      await setUser(updatedUser);
    } catch (error) {
      clearUser();
      throw error;
    }
  }, [state.user, setUser, clearUser]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    refreshToken,
    clearError: () => setError(null),
  };
}
