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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo') || '/dashboard';

    // Get auth configuration
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Create PKCE session
    const pkceSession = await createPKCESession(config.redirectUri);

    // Generate session ID for tracking
    const sessionId = generateSessionId();
    setSessionCookie(sessionId);

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: RESPONSE_TYPE,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state: `${pkceSession.state}:${returnTo}:${sessionId}`,
      code_challenge: pkceSession.codeChallenge,
      code_challenge_method: CODE_CHALLENGE_METHOD,
    });

    const authUrl = `${endpoints.authorize}?${authParams.toString()}`;

    // Store PKCE session in a secure way (you might want to use server-side storage in production)
    const response = NextResponse.redirect(authUrl);

    // Store PKCE session data in a temporary cookie (encrypted in production)
    response.cookies.set('pkce_session', JSON.stringify(pkceSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login initiation failed:', error);

    return NextResponse.json(
      {
        error: 'Authentication initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
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
