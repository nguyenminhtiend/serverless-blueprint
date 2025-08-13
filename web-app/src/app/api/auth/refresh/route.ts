/**
 * Token refresh API route
 * Handles automatic token refresh using stored refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig, getOAuthEndpoints } from '@/lib/auth/auth-config';
import {
  getRefreshTokenCookie,
  setRefreshTokenCookie,
  clearAllAuthCookies,
} from '@/lib/auth/cookie-manager';

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
}

interface RefreshTokenResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  refreshed: boolean;
}

interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from secure cookie
    const refreshToken = getRefreshTokenCookie();

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: 'No refresh token available',
          requiresLogin: true,
        },
        { status: 401 },
      );
    }

    try {
      // Attempt to refresh tokens
      const tokens = await refreshAccessToken(refreshToken);

      // Update refresh token if a new one was provided
      if (tokens.refresh_token) {
        setRefreshTokenCookie(tokens.refresh_token, tokens.expires_in);
      }

      // Return new access token and ID token
      const response: RefreshTokenResponse = {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        refreshed: true,
      };

      return NextResponse.json(response);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);

      // Clear invalid refresh token
      clearAllAuthCookies();

      return NextResponse.json(
        {
          error: 'Token refresh failed',
          requiresLogin: true,
          details: refreshError instanceof Error ? refreshError.message : 'Unknown error',
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error('Refresh endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if refresh token exists
    const refreshToken = getRefreshTokenCookie();

    return NextResponse.json({
      hasRefreshToken: !!refreshToken,
      authenticated: !!refreshToken,
    });
  } catch (error) {
    console.error('Refresh status check failed:', error);

    return NextResponse.json({
      hasRefreshToken: false,
      authenticated: false,
    });
  }
}

/**
 * Refreshes access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
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
    let errorMessage = 'Token refresh failed';

    try {
      const errorData: OAuthError = await response.json();
      errorMessage = errorData.error_description || errorData.error || errorMessage;
    } catch {
      // Fallback to status text if JSON parsing fails
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
