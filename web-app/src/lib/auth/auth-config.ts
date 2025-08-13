/**
 * Centralized authentication configuration for OAuth 2.0 + PKCE flow
 */

export interface AuthConfig {
  cognitoRegion: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
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
 * OAuth 2.0 endpoint URLs for Cognito
 */
export function getOAuthEndpoints(domain: string) {
  const baseUrl = `https://${domain}`;

  return {
    authorize: `${baseUrl}/oauth2/authorize`,
    token: `${baseUrl}/oauth2/token`,
    logout: `${baseUrl}/logout`,
    userInfo: `${baseUrl}/oauth2/userInfo`,
  };
}

/**
 * Default OAuth scopes for the application
 */
export const DEFAULT_SCOPES = ['openid', 'email', 'profile'] as const;

/**
 * OAuth response types
 */
export const RESPONSE_TYPE = 'code' as const;

/**
 * PKCE code challenge method (only S256 is secure)
 */
export const CODE_CHALLENGE_METHOD = 'S256' as const;
