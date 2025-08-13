/**
 * OAuth callback handler API route
 * Handles authorization code exchange and token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig, getOAuthEndpoints } from '@/lib/auth/auth-config';
import { PKCESession } from '@/lib/auth/pkce-utils';
import { setRefreshTokenCookie, getSessionCookie } from '@/lib/auth/cookie-manager';

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check for OAuth errors first
    const error = searchParams.get('error');
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('OAuth error:', { error, errorDescription });

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url),
      );
    }

    // Get authorization code and state
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(new URL('/login?error=missing_parameters', request.url));
    }

    // Parse state parameter (format: "pkceState:returnTo:sessionId")
    const [pkceState, returnTo = '/dashboard', expectedSessionId] = state.split(':');

    // Validate session ID
    const currentSessionId = await getSessionCookie();
    if (expectedSessionId !== currentSessionId) {
      console.error('Session ID mismatch:', {
        expected: expectedSessionId,
        current: currentSessionId,
      });
      return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
    }

    // Retrieve PKCE session from cookie
    const pkceSessionCookie = request.cookies.get('pkce_session');
    if (!pkceSessionCookie) {
      return NextResponse.redirect(new URL('/login?error=missing_pkce_session', request.url));
    }

    let pkceSession: PKCESession;
    try {
      pkceSession = JSON.parse(pkceSessionCookie.value);
    } catch {
      return NextResponse.redirect(new URL('/login?error=invalid_pkce_session', request.url));
    }

    // Validate state parameter (CSRF protection)
    if (pkceState !== pkceSession.state) {
      console.error('State mismatch:', { expected: pkceSession.state, received: pkceState });
      return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
    }

    // Validate PKCE session age (should be within 10 minutes)
    if (Date.now() - pkceSession.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, pkceSession);

    console.log('Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasIdToken: !!tokens.id_token,
      expiresIn: tokens.expires_in
    });

    // Store refresh token in secure cookie
    await setRefreshTokenCookie(tokens.refresh_token, tokens.expires_in);
    console.log('Refresh token cookie set');

    // Create response with redirect
    const redirectUrl = new URL(returnTo, request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Clear PKCE session cookie
    response.cookies.set('pkce_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    // Set access token in a short-lived cookie for client-side pickup
    response.cookies.set('access_token_temp', tokens.access_token, {
      httpOnly: false, // Accessible to client-side JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60, // 1 minute - just long enough for client to pick it up
      path: '/',
    });

    // Set ID token in a short-lived cookie for client-side pickup
    response.cookies.set('id_token_temp', tokens.id_token, {
      httpOnly: false, // Accessible to client-side JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60, // 1 minute
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth callback failed:', error);

    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(code: string, session: PKCESession): Promise<TokenResponse> {
  const config = getAuthConfig();
  const endpoints = getOAuthEndpoints(config.domain);

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: session.redirectUri,
    code_verifier: session.codeVerifier,
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
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
  }

  return response.json();
}
