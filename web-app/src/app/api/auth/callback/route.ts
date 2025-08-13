/**
 * OAuth callback handler API route
 * Handles authorization code exchange and token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { PKCESession } from '@/lib/auth/pkce-utils';
import { setRefreshTokenCookie, getSessionCookie } from '@/lib/auth/cookie-manager';
import { oauthService } from '@/lib/auth/oauth-service';
import { AuthErrorCode, createAuthError } from '@/lib/auth/oauth-types';
import { decryptPKCESession, validateEncryptionConfig } from '@/lib/auth/session-encryption';
import { authLogger, AuthEventType } from '@/lib/auth/auth-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check for OAuth errors first
    const error = searchParams.get('error');
    if (error) {
      const errorDescription = searchParams.get('error_description');
      authLogger.logAuthFailure(
        AuthEventType.LOGIN_FAILED,
        new Error(errorDescription || error),
        { error, errorDescription, source: 'oauth_provider' },
        request,
      );

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url),
      );
    }

    // Get authorization code and state
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      const authError = createAuthError(
        AuthErrorCode.MISSING_PARAMETERS,
        'Missing authorization code or state parameter',
        { code: !!code, state: !!state },
      );
      authLogger.logAuthFailure(
        AuthEventType.LOGIN_FAILED,
        authError,
        { code: !!code, state: !!state },
        request,
      );
      return NextResponse.redirect(new URL('/login?error=missing_parameters', request.url));
    }

    // Parse state parameter (format: "pkceState:returnTo:sessionId")
    const [pkceState, returnTo = '/dashboard', expectedSessionId] = state.split(':');

    // Validate session ID
    const currentSessionId = await getSessionCookie();
    if (expectedSessionId !== currentSessionId) {
      const authError = createAuthError(
        AuthErrorCode.INVALID_SESSION,
        'Session ID mismatch - possible security issue',
        { expected: expectedSessionId, current: currentSessionId },
      );
      authLogger.logSecurityViolation('Session ID mismatch detected', authError.details, request);
      return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
    }

    // Retrieve PKCE session from cookie
    const pkceSessionCookie = request.cookies.get('pkce_session');
    if (!pkceSessionCookie?.value) {
      const authError = createAuthError(
        AuthErrorCode.MISSING_PKCE_SESSION,
        'PKCE session cookie not found',
        { hasCookie: !!pkceSessionCookie },
      );
      authLogger.logAuthFailure(
        AuthEventType.PKCE_SESSION_INVALID,
        authError,
        authError.details,
        request,
      );
      return NextResponse.redirect(new URL('/login?error=missing_pkce_session', request.url));
    }

    let pkceSession: PKCESession;
    try {
      // Try to decrypt session data if encryption is available
      if (validateEncryptionConfig()) {
        pkceSession = await decryptPKCESession<PKCESession>(pkceSessionCookie.value);
      } else {
        // Fallback to JSON parsing for development
        pkceSession = JSON.parse(pkceSessionCookie.value);
      }

      // Validate PKCE session structure
      if (
        !pkceSession.codeVerifier ||
        !pkceSession.state ||
        !pkceSession.redirectUri ||
        !pkceSession.timestamp
      ) {
        throw new Error('Invalid PKCE session structure');
      }
    } catch (parseError) {
      const authError = createAuthError(
        AuthErrorCode.INVALID_PKCE_SESSION,
        'Failed to parse or decrypt PKCE session',
        { hasSessionData: !!pkceSessionCookie.value },
        parseError instanceof Error ? parseError : new Error(String(parseError)),
      );
      authLogger.logAuthFailure(
        AuthEventType.PKCE_SESSION_INVALID,
        authError,
        authError.details,
        request,
      );
      return NextResponse.redirect(new URL('/login?error=invalid_pkce_session', request.url));
    }

    // Validate state parameter (CSRF protection)
    if (pkceState !== pkceSession.state) {
      const authError = createAuthError(
        AuthErrorCode.INVALID_STATE,
        'State parameter mismatch - possible CSRF attack',
        { expected: pkceSession.state, received: pkceState },
      );
      authLogger.logSecurityViolation(
        'CSRF attack detected - state parameter mismatch',
        authError.details,
        request,
      );
      return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
    }

    // Validate PKCE session age (should be within 10 minutes)
    const sessionAge = Date.now() - pkceSession.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (sessionAge > maxAge) {
      const authError = createAuthError(AuthErrorCode.SESSION_EXPIRED, 'PKCE session has expired', {
        sessionAge,
        maxAge,
        timestamp: pkceSession.timestamp,
      });
      authLogger.logAuthFailure(
        AuthEventType.SESSION_EXPIRED,
        authError,
        authError.details,
        request,
      );
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
    }

    // Exchange authorization code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(
      code,
      pkceSession.codeVerifier,
      pkceSession.redirectUri,
    );

    // Store refresh token in secure cookie
    await setRefreshTokenCookie(tokens.refresh_token, tokens.expires_in);

    // Log successful authentication
    authLogger.logAuthSuccess(AuthEventType.LOGIN_SUCCESS, undefined, {
      returnTo,
      sessionId: expectedSessionId,
      tokenExpiry: tokens.expires_in,
    });

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
    const authError = createAuthError(
      AuthErrorCode.CALLBACK_FAILED,
      'OAuth callback processing failed',
      { url: request.url },
      error instanceof Error ? error : new Error(String(error)),
    );
    authLogger.logAuthFailure(AuthEventType.LOGIN_FAILED, authError, authError.details, request);

    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}
