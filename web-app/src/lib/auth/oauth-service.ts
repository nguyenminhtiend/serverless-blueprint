/**
 * Centralized OAuth service for token exchange operations
 * Eliminates duplicate code between client and server-side handlers
 */

import { getAuthConfig, getOAuthEndpoints } from './auth-config';
import type {
  TokenResponse,
  OAuthError,
  TokenExchangeParams,
  RefreshTokenParams,
  AuthError,
} from './oauth-types';
import { createAuthError, AuthErrorCode } from './oauth-types';

/**
 * Service class for OAuth operations with proper error handling
 */
export class OAuthService {
  private config = getAuthConfig();
  private endpoints = getOAuthEndpoints(this.config.domain);

  /**
   * Exchanges authorization code for tokens using PKCE
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    try {
      const params: TokenExchangeParams = {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      };

      const response = await this.makeTokenRequest(params);

      if (!this.isValidTokenResponse(response)) {
        throw createAuthError(
          AuthErrorCode.TOKEN_EXCHANGE_FAILED,
          'Invalid token response format',
          { response },
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw auth errors
      }

      throw createAuthError(
        AuthErrorCode.TOKEN_EXCHANGE_FAILED,
        'Token exchange failed',
        { code, redirectUri },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const params: RefreshTokenParams = {
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      };

      const response = await this.makeTokenRequest(params);

      if (!this.isValidTokenResponse(response, false)) {
        throw createAuthError(
          AuthErrorCode.TOKEN_REFRESH_FAILED,
          'Invalid refresh response format',
          { response },
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw auth errors
      }

      throw createAuthError(
        AuthErrorCode.TOKEN_REFRESH_FAILED,
        'Token refresh failed',
        {},
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Makes a token request to Cognito with proper error handling
   */
  private async makeTokenRequest(
    params: TokenExchangeParams | RefreshTokenParams,
  ): Promise<TokenResponse> {
    const response = await fetch(this.endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params as any),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw createAuthError(
        params.grant_type === 'authorization_code'
          ? AuthErrorCode.TOKEN_EXCHANGE_FAILED
          : AuthErrorCode.TOKEN_REFRESH_FAILED,
        errorData.error_description || errorData.error || `HTTP ${response.status}`,
        {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        },
      );
    }

    return response.json();
  }

  /**
   * Safely parses error response from OAuth endpoint
   */
  private async parseErrorResponse(response: Response): Promise<OAuthError> {
    try {
      const errorData: OAuthError = await response.json();
      return errorData;
    } catch {
      return {
        error: 'unknown_error',
        error_description: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  }

  /**
   * Validates token response structure
   */
  private isValidTokenResponse(
    response: any,
    requireRefreshToken: boolean = true,
  ): response is TokenResponse {
    return (
      response &&
      typeof response.access_token === 'string' &&
      typeof response.id_token === 'string' &&
      response.token_type === 'Bearer' &&
      typeof response.expires_in === 'number' &&
      (!requireRefreshToken || typeof response.refresh_token === 'string')
    );
  }
}

/**
 * Singleton instance for OAuth operations
 */
export const oauthService = new OAuthService();
