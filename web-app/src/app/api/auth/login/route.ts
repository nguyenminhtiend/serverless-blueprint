/**
 * OAuth login initiation API route
 * Generates PKCE parameters and redirects to Cognito Hosted UI
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthConfig,
  getOAuthEndpoints,
  RESPONSE_TYPE,
  CODE_CHALLENGE_METHOD,
} from '@/lib/auth/auth-config';
import { createPKCESession } from '@/lib/auth/pkce-utils';
import { setSessionCookie, generateSessionId } from '@/lib/auth/cookie-manager';
import { encryptPKCESession, validateEncryptionConfig } from '@/lib/auth/session-encryption';
import { createAuthError, AuthErrorCode } from '@/lib/auth/oauth-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo') || '/dashboard';

    // Validate returnTo parameter to prevent open redirects
    const allowedPaths = ['/dashboard', '/orders', '/profile', '/'];
    const sanitizedReturnTo = allowedPaths.includes(returnTo) ? returnTo : '/dashboard';

    // Get auth configuration
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Create PKCE session
    const pkceSession = await createPKCESession(config.redirectUri);

    // Generate session ID for tracking
    const sessionId = generateSessionId();
    await setSessionCookie(sessionId);

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: RESPONSE_TYPE,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state: `${pkceSession.state}:${sanitizedReturnTo}:${sessionId}`,
      code_challenge: pkceSession.codeChallenge,
      code_challenge_method: CODE_CHALLENGE_METHOD,
    });

    const authUrl = `${endpoints.authorize}?${authParams.toString()}`;

    // Create response with redirect
    const response = NextResponse.redirect(authUrl);

    // Store PKCE session data securely
    try {
      let sessionData: string;

      if (validateEncryptionConfig()) {
        // Encrypt PKCE session in production
        sessionData = await encryptPKCESession(pkceSession);
      } else {
        // Fallback to JSON for development
        sessionData = JSON.stringify(pkceSession);
      }

      response.cookies.set('pkce_session', sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });
    } catch (encryptionError) {
      console.error('PKCE session encryption failed:', encryptionError);

      // Fallback to unencrypted for development only
      if (process.env.NODE_ENV !== 'production') {
        response.cookies.set('pkce_session', JSON.stringify(pkceSession), {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 600,
          path: '/',
        });
      } else {
        throw createAuthError(
          AuthErrorCode.SESSION_EXPIRED,
          'Failed to secure PKCE session',
          { sessionId },
          encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)),
        );
      }
    }

    return response;
  } catch (error) {
    const authError = createAuthError(
      AuthErrorCode.TOKEN_EXCHANGE_FAILED,
      'Login initiation failed',
      { url: request.url },
      error instanceof Error ? error : new Error(String(error)),
    );
    console.error('Login initiation failed:', authError);

    return NextResponse.json(
      {
        error: 'Authentication initialization failed',
        details: authError.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { returnTo = '/dashboard' } = body;

    // Validate returnTo URL to prevent open redirects
    const allowedPaths = ['/dashboard', '/orders', '/profile'];
    const sanitizedReturnTo = allowedPaths.includes(returnTo) ? returnTo : '/dashboard';

    // Create redirect URL
    const loginUrl = new URL('/api/auth/login', request.url);
    loginUrl.searchParams.set('returnTo', sanitizedReturnTo);

    return NextResponse.json({
      redirectUrl: loginUrl.toString(),
    });
  } catch (error) {
    console.error('Login POST failed:', error);

    return NextResponse.json(
      {
        error: 'Authentication initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
