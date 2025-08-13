/**
 * Logout handler API route
 * Clears authentication cookies and redirects to Cognito logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig, getOAuthEndpoints } from '@/lib/auth/auth-config';
import { clearAllAuthCookies } from '@/lib/auth/cookie-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo') || '/';

    // Clear all authentication cookies
    clearAllAuthCookies();

    // Get auth configuration for Cognito logout
    const config = getAuthConfig();
    const endpoints = getOAuthEndpoints(config.domain);

    // Build Cognito logout URL
    const logoutParams = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: new URL(returnTo, request.url).toString(),
    });

    const logoutUrl = `${endpoints.logout}?${logoutParams.toString()}`;

    // Create response with redirect to Cognito logout
    const response = NextResponse.redirect(logoutUrl);

    // Ensure cookies are cleared in response
    response.cookies.set('auth_refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    response.cookies.set('auth_session_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    // Clear any temporary token cookies
    response.cookies.set('access_token_temp', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    response.cookies.set('id_token_temp', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout failed:', error);

    // Fallback: clear cookies and redirect to home
    const response = NextResponse.redirect(new URL('/', request.url));

    // Clear cookies even if there was an error
    response.cookies.set('auth_refresh_token', '', { maxAge: 0, path: '/' });
    response.cookies.set('auth_session_id', '', { maxAge: 0, path: '/' });
    response.cookies.set('access_token_temp', '', { maxAge: 0, path: '/' });
    response.cookies.set('id_token_temp', '', { maxAge: 0, path: '/' });

    return response;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { returnTo = '/' } = body;

    // Validate returnTo URL to prevent open redirects
    const allowedPaths = ['/', '/login', '/register'];
    const sanitizedReturnTo = allowedPaths.includes(returnTo) ? returnTo : '/';

    // Create logout URL
    const logoutUrl = new URL('/api/auth/logout', request.url);
    logoutUrl.searchParams.set('returnTo', sanitizedReturnTo);

    return NextResponse.json({
      logoutUrl: logoutUrl.toString(),
    });
  } catch (error) {
    console.error('Logout POST failed:', error);

    return NextResponse.json(
      {
        error: 'Logout failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
