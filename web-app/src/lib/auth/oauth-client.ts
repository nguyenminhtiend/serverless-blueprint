/**
 * OAuth 2.0 client for Cognito Hosted UI with PKCE support
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

/**
 * OAuth authorization URL parameters
 */
interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

/**
 * OAuth token exchange parameters
 */
interface TokenParams {
  grant_type: 'authorization_code';
  client_id: string;
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

/**
 * OAuth token response
 */
interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * OAuth error response
 */
interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Initiates OAuth 2.0 authorization flow with PKCE
 * Creates PKCE session and redirects to Cognito Hosted UI
 */
export async function initiateOAuthFlow(): Promise<void> {
  try {
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Create PKCE session
    const pkceSession = await createPKCESession(config.redirectUri);
    storePKCESession(pkceSession);

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(config, pkceSession);

    // Redirect to Cognito Hosted UI
    window.location.href = authUrl;
  } catch (error) {
    console.error('Failed to initiate OAuth flow:', error);
    throw new Error('Authentication initialization failed');
  }
}

/**
 * Builds the authorization URL for Cognito Hosted UI
 * @param config Auth configuration
 * @param session PKCE session data
 * @returns Complete authorization URL
 */
function buildAuthorizationUrl(config: AuthConfig, session: PKCESession): string {
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

  const urlParams = new URLSearchParams(params);
  return `${endpoints.authorize}?${urlParams.toString()}`;
}

/**
 * Handles OAuth callback and exchanges authorization code for tokens
 * @param code Authorization code from callback
 * @param state State parameter from callback
 * @returns Promise resolving to token response
 */
export async function handleOAuthCallback(code: string, state: string): Promise<TokenResponse> {
  try {
    // Retrieve and validate PKCE session
    const pkceSession = retrievePKCESession();
    if (!pkceSession) {
      throw new Error('No valid PKCE session found');
    }

    // Validate state parameter (CSRF protection)
    if (state !== pkceSession.state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, pkceSession);

    // Clean up PKCE session
    clearPKCESession();

    return tokens;
  } catch (error) {
    clearPKCESession();
    console.error('OAuth callback handling failed:', error);
    throw error;
  }
}

/**
 * Exchanges authorization code for access and refresh tokens
 * @param code Authorization code
 * @param session PKCE session data
 * @returns Promise resolving to token response
 */
async function exchangeCodeForTokens(code: string, session: PKCESession): Promise<TokenResponse> {
  const config = getAuthConfig();
  const endpoints = getOAuthEndpoints(config.domain);

  const params: TokenParams = {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: session.redirectUri,
    code_verifier: session.codeVerifier,
  };

  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const errorData: OAuthError = await response.json();
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
  }

  return response.json();
}

/**
 * Initiates logout flow
 * Redirects to Cognito logout endpoint and clears local session
 */
export function initiateLogout(): void {
  try {
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Build logout URL
    const logoutParams = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: config.logoutUri,
    });

    const logoutUrl = `${endpoints.logout}?${logoutParams.toString()}`;

    // Clear any stored session data
    clearPKCESession();

    // Redirect to Cognito logout
    window.location.href = logoutUrl;
  } catch (error) {
    console.error('Logout failed:', error);
    // Fallback: clear session and redirect to home
    clearPKCESession();
    window.location.href = '/';
  }
}

/**
 * Refreshes access token using refresh token
 * Note: This will be handled server-side in API routes
 * @param refreshToken Refresh token
 * @returns Promise resolving to new token response
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = getAuthConfig();
  const endpoints = getOAuthEndpoints(config.domain);

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  });

  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorData: OAuthError = await response.json();
    throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
  }

  return response.json();
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
