/**
 * Input validation utilities for authentication parameters
 * Provides comprehensive validation and sanitization
 */

import { AuthErrorCode, createAuthError } from './oauth-types';

/**
 * Validation result type
 */
interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  error?: string;
  sanitized?: T;
}

/**
 * URL validation patterns
 */
const URL_PATTERNS = {
  ALLOWED_RETURN_PATHS: /^\/(?:dashboard|orders|profile|auth\/callback)?(?:\/.*)?$/,
  COGNITO_DOMAIN: /^[a-zA-Z0-9][a-zA-Z0-9-]*\.auth\.[a-z0-9-]+\.amazoncognito\.com$/,
  OAUTH_REDIRECT: /^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/auth\/callback$/,
};

/**
 * OAuth parameter validation patterns
 */
const OAUTH_PATTERNS = {
  AUTHORIZATION_CODE: /^[a-zA-Z0-9_-]{20,128}$/,
  STATE_PARAMETER: /^[a-zA-Z0-9_-]{16,256}$/,
  CODE_VERIFIER: /^[a-zA-Z0-9._~-]{43,128}$/,
  CODE_CHALLENGE: /^[a-zA-Z0-9._~-]{43,128}$/,
  CLIENT_ID: /^[a-zA-Z0-9]{26}$/,
  SESSION_ID: /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/,
};

/**
 * Security limits
 */
const SECURITY_LIMITS = {
  MAX_STRING_LENGTH: 2048,
  MAX_URL_LENGTH: 2048,
  MAX_STATE_PARTS: 5,
  MIN_SESSION_AGE: 1000, // 1 second
  MAX_SESSION_AGE: 10 * 60 * 1000, // 10 minutes
};

/**
 * Validates and sanitizes return URL paths
 */
export function validateReturnPath(path: string): ValidationResult<string> {
  if (!path || typeof path !== 'string') {
    return { isValid: false, error: 'Return path must be a non-empty string' };
  }

  if (path.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
    return { isValid: false, error: 'Return path exceeds maximum length' };
  }

  // Remove any query parameters and fragments for security
  const cleanPath = path.split('?')[0].split('#')[0];

  // Validate against allowed patterns
  if (!URL_PATTERNS.ALLOWED_RETURN_PATHS.test(cleanPath)) {
    return {
      isValid: false,
      error: 'Return path not in allowed list',
      sanitized: '/dashboard', // Safe fallback
    };
  }

  // Additional security checks
  if (cleanPath.includes('..') || cleanPath.includes('//')) {
    return {
      isValid: false,
      error: 'Return path contains invalid sequences',
      sanitized: '/dashboard',
    };
  }

  return { isValid: true, value: cleanPath, sanitized: cleanPath };
}

/**
 * Validates OAuth authorization code
 */
export function validateAuthorizationCode(code: string): ValidationResult<string> {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'Authorization code must be a non-empty string' };
  }

  if (!OAUTH_PATTERNS.AUTHORIZATION_CODE.test(code)) {
    return { isValid: false, error: 'Authorization code format is invalid' };
  }

  return { isValid: true, value: code, sanitized: code };
}

/**
 * Validates OAuth state parameter
 */
export function validateStateParameter(state: string): ValidationResult<string> {
  if (!state || typeof state !== 'string') {
    return { isValid: false, error: 'State parameter must be a non-empty string' };
  }

  if (state.length > SECURITY_LIMITS.MAX_STRING_LENGTH) {
    return { isValid: false, error: 'State parameter exceeds maximum length' };
  }

  // State parameter should contain colon-separated parts
  const parts = state.split(':');
  if (parts.length < 2 || parts.length > SECURITY_LIMITS.MAX_STATE_PARTS) {
    return { isValid: false, error: 'State parameter has invalid structure' };
  }

  // Validate individual parts
  const [pkceState, returnTo, sessionId] = parts;

  if (!OAUTH_PATTERNS.STATE_PARAMETER.test(pkceState)) {
    return { isValid: false, error: 'PKCE state component is invalid' };
  }

  if (sessionId && !OAUTH_PATTERNS.SESSION_ID.test(sessionId)) {
    return { isValid: false, error: 'Session ID component is invalid' };
  }

  return { isValid: true, value: state, sanitized: state };
}

/**
 * Validates PKCE code verifier
 */
export function validateCodeVerifier(codeVerifier: string): ValidationResult<string> {
  if (!codeVerifier || typeof codeVerifier !== 'string') {
    return { isValid: false, error: 'Code verifier must be a non-empty string' };
  }

  if (!OAUTH_PATTERNS.CODE_VERIFIER.test(codeVerifier)) {
    return { isValid: false, error: 'Code verifier format is invalid' };
  }

  return { isValid: true, value: codeVerifier, sanitized: codeVerifier };
}

/**
 * Validates PKCE code challenge
 */
export function validateCodeChallenge(codeChallenge: string): ValidationResult<string> {
  if (!codeChallenge || typeof codeChallenge !== 'string') {
    return { isValid: false, error: 'Code challenge must be a non-empty string' };
  }

  if (!OAUTH_PATTERNS.CODE_CHALLENGE.test(codeChallenge)) {
    return { isValid: false, error: 'Code challenge format is invalid' };
  }

  return { isValid: true, value: codeChallenge, sanitized: codeChallenge };
}

/**
 * Validates Cognito client ID
 */
export function validateClientId(clientId: string): ValidationResult<string> {
  if (!clientId || typeof clientId !== 'string') {
    return { isValid: false, error: 'Client ID must be a non-empty string' };
  }

  if (!OAUTH_PATTERNS.CLIENT_ID.test(clientId)) {
    return { isValid: false, error: 'Client ID format is invalid' };
  }

  return { isValid: true, value: clientId, sanitized: clientId };
}

/**
 * Validates Cognito domain
 */
export function validateCognitoDomain(domain: string): ValidationResult<string> {
  if (!domain || typeof domain !== 'string') {
    return { isValid: false, error: 'Cognito domain must be a non-empty string' };
  }

  if (!URL_PATTERNS.COGNITO_DOMAIN.test(domain)) {
    return { isValid: false, error: 'Cognito domain format is invalid' };
  }

  return { isValid: true, value: domain, sanitized: domain };
}

/**
 * Validates OAuth redirect URI
 */
export function validateRedirectUri(uri: string): ValidationResult<string> {
  if (!uri || typeof uri !== 'string') {
    return { isValid: false, error: 'Redirect URI must be a non-empty string' };
  }

  if (uri.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
    return { isValid: false, error: 'Redirect URI exceeds maximum length' };
  }

  // For development, allow localhost
  if (process.env.NODE_ENV === 'development' && uri.startsWith('http://localhost:')) {
    return { isValid: true, value: uri, sanitized: uri };
  }

  if (!URL_PATTERNS.OAUTH_REDIRECT.test(uri)) {
    return { isValid: false, error: 'Redirect URI format is invalid' };
  }

  return { isValid: true, value: uri, sanitized: uri };
}

/**
 * Validates session ID
 */
export function validateSessionId(sessionId: string): ValidationResult<string> {
  if (!sessionId || typeof sessionId !== 'string') {
    return { isValid: false, error: 'Session ID must be a non-empty string' };
  }

  if (!OAUTH_PATTERNS.SESSION_ID.test(sessionId)) {
    return { isValid: false, error: 'Session ID format is invalid' };
  }

  return { isValid: true, value: sessionId, sanitized: sessionId };
}

/**
 * Validates PKCE session timestamp
 */
export function validateSessionTimestamp(timestamp: number): ValidationResult<number> {
  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    return { isValid: false, error: 'Session timestamp must be a valid number' };
  }

  const now = Date.now();
  const age = now - timestamp;

  if (age < SECURITY_LIMITS.MIN_SESSION_AGE) {
    return { isValid: false, error: 'Session timestamp is too recent (possible replay attack)' };
  }

  if (age > SECURITY_LIMITS.MAX_SESSION_AGE) {
    return { isValid: false, error: 'Session has expired' };
  }

  return { isValid: true, value: timestamp, sanitized: timestamp };
}

/**
 * Validates complete PKCE session structure
 */
export function validatePKCESession(session: any): ValidationResult<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  redirectUri: string;
  timestamp: number;
}> {
  if (!session || typeof session !== 'object') {
    return { isValid: false, error: 'PKCE session must be a valid object' };
  }

  const validations = [
    { field: 'codeVerifier', validator: validateCodeVerifier, value: session.codeVerifier },
    { field: 'codeChallenge', validator: validateCodeChallenge, value: session.codeChallenge },
    { field: 'state', validator: validateStateParameter, value: session.state },
    { field: 'redirectUri', validator: validateRedirectUri, value: session.redirectUri },
    { field: 'timestamp', validator: validateSessionTimestamp, value: session.timestamp },
  ];

  for (const { field, validator, value } of validations) {
    const result = validator(value);
    if (!result.isValid) {
      return { isValid: false, error: `Invalid ${field}: ${result.error}` };
    }
  }

  return {
    isValid: true,
    value: {
      codeVerifier: session.codeVerifier,
      codeChallenge: session.codeChallenge,
      state: session.state,
      redirectUri: session.redirectUri,
      timestamp: session.timestamp,
    },
  };
}

/**
 * Sanitizes and validates environment variables
 */
export function validateAuthConfig(config: any): ValidationResult<{
  cognitoRegion: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  redirectUri: string;
}> {
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Auth config must be a valid object' };
  }

  const { cognitoRegion, userPoolId, clientId, domain, redirectUri } = config;

  // Validate required fields
  if (!cognitoRegion || typeof cognitoRegion !== 'string') {
    return { isValid: false, error: 'Cognito region is required' };
  }

  if (!userPoolId || typeof userPoolId !== 'string') {
    return { isValid: false, error: 'User pool ID is required' };
  }

  const clientIdResult = validateClientId(clientId);
  if (!clientIdResult.isValid) {
    return { isValid: false, error: `Client ID validation failed: ${clientIdResult.error}` };
  }

  const domainResult = validateCognitoDomain(domain);
  if (!domainResult.isValid) {
    return { isValid: false, error: `Domain validation failed: ${domainResult.error}` };
  }

  const redirectResult = validateRedirectUri(redirectUri);
  if (!redirectResult.isValid) {
    return { isValid: false, error: `Redirect URI validation failed: ${redirectResult.error}` };
  }

  return {
    isValid: true,
    value: {
      cognitoRegion,
      userPoolId,
      clientId: clientIdResult.value!,
      domain: domainResult.value!,
      redirectUri: redirectResult.value!,
    },
  };
}

/**
 * Creates validation error with proper error code
 */
export function createValidationError(message: string, field?: string): never {
  throw createAuthError(AuthErrorCode.INVALID_PARAMETERS, `Validation failed: ${message}`, {
    field,
    validationError: true,
  });
}

/**
 * Validates and throws on invalid input
 */
export function validateOrThrow<T>(
  validator: (value: any) => ValidationResult<T>,
  value: any,
  fieldName: string,
): T {
  const result = validator(value);
  if (!result.isValid) {
    createValidationError(`${fieldName} - ${result.error}`, fieldName);
  }
  return result.value!;
}
