/**
 * Token refresh API route
 * Handles automatic token refresh using stored refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRefreshTokenCookie,
  setRefreshTokenCookie,
  clearAllAuthCookies,
} from '@/lib/auth/cookie-manager';
import { oauthService } from '@/lib/auth/oauth-service';
import { AuthErrorCode, createAuthError, type RefreshResponse } from '@/lib/auth/oauth-types';
import { checkRateLimit } from '@/lib/auth/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitResult = checkRateLimit('refresh', request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
          requiresLogin: false,
        },
        {
          status: 429,
          headers: rateLimitResult.retryAfter
            ? { 'Retry-After': rateLimitResult.retryAfter.toString() }
            : {},
        },
      );
    }

    // Get refresh token from secure cookie
    const refreshToken = await getRefreshTokenCookie();

    if (!refreshToken) {
      const authError = createAuthError(
        AuthErrorCode.TOKEN_REFRESH_FAILED,
        'No refresh token available in secure cookie',
        { hasToken: false },
      );
      console.error('Refresh token missing:', authError);

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
      const tokens = await oauthService.refreshAccessToken(refreshToken);

      // Update refresh token if a new one was provided
      if (tokens.refresh_token) {
        await setRefreshTokenCookie(tokens.refresh_token, tokens.expires_in);
      }

      // Return new access token and ID token
      const response: RefreshResponse = {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        refreshed: true,
      };

      return NextResponse.json(response);
    } catch (refreshError) {
      const authError = createAuthError(
        AuthErrorCode.TOKEN_REFRESH_FAILED,
        'Token refresh operation failed',
        {},
        refreshError instanceof Error ? refreshError : new Error(String(refreshError)),
      );
      console.error('Token refresh failed:', authError);

      // Clear invalid refresh token
      await clearAllAuthCookies();

      return NextResponse.json(
        {
          error: 'Token refresh failed',
          requiresLogin: true,
          details: authError.message,
        },
        { status: 401 },
      );
    }
  } catch (error) {
    const authError = createAuthError(
      AuthErrorCode.TOKEN_REFRESH_FAILED,
      'Refresh endpoint internal error',
      { url: request.url },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('Refresh endpoint error:', authError);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: authError.message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if refresh token exists
    const refreshToken = await getRefreshTokenCookie();

    return NextResponse.json({
      hasRefreshToken: !!refreshToken,
      authenticated: !!refreshToken,
    });
  } catch (error) {
    const authError = createAuthError(
      AuthErrorCode.TOKEN_REFRESH_FAILED,
      'Refresh token status check failed',
      { url: request.url },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('Refresh status check failed:', authError);

    return NextResponse.json({
      hasRefreshToken: false,
      authenticated: false,
    });
  }
}
