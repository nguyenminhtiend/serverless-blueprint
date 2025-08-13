/**
 * OAuth 2.0 client for Cognito Hosted UI with PKCE support
 * Handles client-side OAuth flow initiation and logout
 */

import {
  getAuthConfig,
  getOAuthEndpoints,
  RESPONSE_TYPE,
  CODE_CHALLENGE_METHOD,
} from './auth-config';
import {
  createPKCESession,
  storePKCESession,
  retrievePKCESession,
  clearPKCESession,
  type PKCESession,
} from './pkce-utils';
import { oauthService } from './oauth-service';
import type {
  AuthorizeParams,
  TokenResponse,
  OAuthError,
  AuthError,
  AuthErrorCode,
} from './oauth-types';
import { createAuthError } from './oauth-types';

/**
 * Initiates OAuth 2.0 authorization flow with PKCE
 * Creates PKCE session and redirects to Cognito Hosted UI
 * @param returnTo Optional path to return to after authentication
 */
export async function initiateOAuthFlow(returnTo?: string): Promise<void> {
  try {
    const config = getAuthConfig();

    // Create PKCE session
    const pkceSession = await createPKCESession(config.redirectUri);
    storePKCESession(pkceSession);

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(config, pkceSession);

    // Redirect to Cognito Hosted UI
    window.location.href = authUrl;
  } catch (error) {
    const authError = createAuthError(
      'AUTHENTICATION_INIT_FAILED' as AuthErrorCode,
      'Failed to initiate OAuth flow',
      { returnTo },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('OAuth flow initiation failed:', authError);
    throw authError;
  }
}

/**
 * Builds the authorization URL for Cognito Hosted UI
 * @param config Auth configuration
 * @param session PKCE session data
 * @returns Complete authorization URL
 */
function buildAuthorizationUrl(config: any, session: PKCESession): string {
  const endpoints = getOAuthEndpoints(config.domain);

  const params: AuthorizeParams = {
    response_type: RESPONSE_TYPE,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state: session.state,
    code_challenge: session.codeChallenge,
    code_challenge_method: CODE_CHALLENGE_METHOD,
  };

  const urlParams = new URLSearchParams(params as any);
  return `${endpoints.authorize}?${urlParams.toString()}`;
}

/**
 * Handles OAuth callback and exchanges authorization code for tokens
 * Note: This is primarily for client-side handling. Server-side callback is preferred.
 * @param code Authorization code from callback
 * @param state State parameter from callback
 * @returns Promise resolving to token response
 */
export async function handleOAuthCallback(code: string, state: string): Promise<TokenResponse> {
  try {
    // Retrieve and validate PKCE session
    const pkceSession = retrievePKCESession();
    if (!pkceSession) {
      throw createAuthError(
        'MISSING_PKCE_SESSION' as AuthErrorCode,
        'No valid PKCE session found in storage',
        { hasCode: !!code, hasState: !!state },
      );
    }

    // Validate state parameter (CSRF protection)
    if (state !== pkceSession.state) {
      throw createAuthError(
        'INVALID_STATE' as AuthErrorCode,
        'State parameter mismatch - possible CSRF attack',
        { expected: pkceSession.state, received: state },
      );
    }

    // Exchange authorization code for tokens using the service
    const tokens = await oauthService.exchangeCodeForTokens(
      code,
      pkceSession.codeVerifier,
      pkceSession.redirectUri,
    );

    // Clean up PKCE session
    clearPKCESession();

    return tokens;
  } catch (error) {
    clearPKCESession();

    if (error instanceof Error && 'code' in error) {
      throw error; // Re-throw auth errors
    }

    const authError = createAuthError(
      'CALLBACK_FAILED' as AuthErrorCode,
      'OAuth callback handling failed',
      { code, state },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('OAuth callback handling failed:', authError);
    throw authError;
  }
}

/**
 * Initiates logout flow
 * Redirects to Cognito logout endpoint and clears local session
 * @param returnTo Optional path to return to after logout
 */
export function initiateLogout(returnTo: string = '/'): void {
  try {
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Build logout URL
    const logoutParams = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: new URL(returnTo, window.location.origin).toString(),
    });

    const logoutUrl = `${endpoints.logout}?${logoutParams.toString()}`;

    // Clear any stored session data
    clearPKCESession();

    // Redirect to Cognito logout
    window.location.href = logoutUrl;
  } catch (error) {
    const authError = createAuthError(
      'LOGOUT_FAILED' as AuthErrorCode,
      'Failed to initiate logout flow',
      { returnTo },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('Logout failed:', authError);

    // Fallback: clear session and redirect
    clearPKCESession();
    window.location.href = returnTo;
  }
}

/**
 * Refreshes access token using refresh token
 * Note: This is deprecated in favor of server-side token refresh
 * @param refreshToken Refresh token
 * @returns Promise resolving to new token response
 * @deprecated Use server-side /api/auth/refresh endpoint instead
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return oauthService.refreshAccessToken(refreshToken);
}

/**
 * Parses OAuth error from URL parameters
 * @param searchParams URL search parameters
 * @returns OAuth error object or null
 */
export function parseOAuthError(searchParams: URLSearchParams): OAuthError | null {
  const error = searchParams.get('error');
  if (!error) return null;

  return {
    error,
    error_description: searchParams.get('error_description') || undefined,
    error_uri: searchParams.get('error_uri') || undefined,
  };
}
