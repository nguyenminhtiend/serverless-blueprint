/**
 * Shared OAuth 2.0 types and interfaces for authentication flow
 */

/**
 * OAuth 2.0 token response from Cognito
 */
export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * OAuth 2.0 error response
 */
export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * OAuth authorization URL parameters
 */
export interface AuthorizeParams {
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
export interface TokenExchangeParams {
  grant_type: 'authorization_code';
  client_id: string;
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

/**
 * OAuth refresh token parameters
 */
export interface RefreshTokenParams {
  grant_type: 'refresh_token';
  client_id: string;
  refresh_token: string;
}

/**
 * Internal API response for token refresh
 */
export interface RefreshResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  refreshed: boolean;
}

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  MISSING_PARAMETERS = 'missing_parameters',
  INVALID_SESSION = 'invalid_session',
  MISSING_PKCE_SESSION = 'missing_pkce_session',
  INVALID_PKCE_SESSION = 'invalid_pkce_session',
  INVALID_STATE = 'invalid_state',
  SESSION_EXPIRED = 'session_expired',
  CALLBACK_FAILED = 'callback_failed',
  TOKEN_EXCHANGE_FAILED = 'token_exchange_failed',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  LOGOUT_FAILED = 'logout_failed',
}

/**
 * Structured error for authentication operations
 */
export interface AuthError extends Error {
  code: AuthErrorCode;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Creates a structured auth error
 */
export function createAuthError(
  code: AuthErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error,
): AuthError {
  const error = new Error(message) as AuthError;
  error.code = code;
  error.details = details;
  error.cause = cause;
  return error;
}
