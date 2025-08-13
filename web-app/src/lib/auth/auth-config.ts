/**
 * Centralized authentication configuration for OAuth 2.0 + PKCE flow
 * Provides secure configuration management with validation
 */

/**
 * Authentication configuration interface
 */
export interface AuthConfig {
  /** AWS Cognito region (e.g., 'us-east-1') */
  cognitoRegion: string;
  /** Cognito User Pool ID */
  userPoolId: string;
  /** Cognito App Client ID (26 characters) */
  clientId: string;
  /** Cognito Hosted UI domain */
  domain: string;
  /** OAuth callback redirect URI */
  redirectUri: string;
  /** Post-logout redirect URI */
  logoutUri: string;
  /** OAuth 2.0 scopes requested */
  scopes: string[];
}

/**
 * Gets authentication configuration from environment variables
 * @returns AuthConfig object with all required OAuth parameters
 */
export function getAuthConfig(): AuthConfig {
  const requiredEnvVars = {
    cognitoRegion: process.env.NEXT_PUBLIC_COGNITO_REGION,
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    redirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
  };

  // Validate that all required environment variables are present
  const missing = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env.local file and ensure all OAuth configuration is set.',
    );
  }

  // Default logout URI to the app root if not specified
  const logoutUri =
    process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URI ||
    new URL('/', requiredEnvVars.redirectUri!).toString();

  return {
    cognitoRegion: requiredEnvVars.cognitoRegion!,
    userPoolId: requiredEnvVars.userPoolId!,
    clientId: requiredEnvVars.clientId!,
    domain: requiredEnvVars.domain!,
    redirectUri: requiredEnvVars.redirectUri!,
    logoutUri,
    scopes: ['openid', 'email', 'profile'],
  };
}

/**
 * OAuth 2.0 endpoint URLs for Cognito Hosted UI
 * @param domain - Cognito domain (e.g., 'your-app.auth.us-east-1.amazoncognito.com')
 * @returns Object containing all OAuth endpoint URLs
 * @example
 * ```typescript
 * const endpoints = getOAuthEndpoints('my-app.auth.us-east-1.amazoncognito.com');
 * console.log(endpoints.authorize); // https://my-app.auth.us-east-1.amazoncognito.com/oauth2/authorize
 * ```
 */
export function getOAuthEndpoints(domain: string) {
  const baseUrl = `https://${domain}`;

  return {
    /** OAuth 2.0 authorization endpoint */
    authorize: `${baseUrl}/oauth2/authorize`,
    /** OAuth 2.0 token endpoint */
    token: `${baseUrl}/oauth2/token`,
    /** Cognito logout endpoint */
    logout: `${baseUrl}/logout`,
    /** OAuth 2.0 user info endpoint */
    userInfo: `${baseUrl}/oauth2/userInfo`,
  };
}

/**
 * Default OAuth scopes for the application
 * - openid: Required for OIDC ID tokens
 * - email: Access to user's email address
 * - profile: Access to user's profile information
 */
export const DEFAULT_SCOPES = ['openid', 'email', 'profile'] as const;

/**
 * OAuth response type for authorization code flow
 * Only 'code' is supported for security reasons
 */
export const RESPONSE_TYPE = 'code' as const;

/**
 * PKCE code challenge method
 * Only 'S256' (SHA256) is supported for security
 */
export const CODE_CHALLENGE_METHOD = 'S256' as const;
