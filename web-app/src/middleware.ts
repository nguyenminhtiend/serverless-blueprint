import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protected routes that require authentication
 */
const PROTECTED_ROUTES = ['/dashboard', '/orders', '/profile'];

/**
 * Public routes that should redirect to dashboard if authenticated
 */
const PUBLIC_AUTH_ROUTES = ['/login', '/register', '/confirm-signup'];

/**
 * Routes that should always be accessible
 */
const ALWAYS_ACCESSIBLE_ROUTES = ['/', '/auth/callback', '/logout'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes, static files, and Next.js internals to pass through
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') ||
    pathname.startsWith('/_vercel')
  ) {
    return NextResponse.next();
  }

  // Check if user has a refresh token (indicates authentication)
  const refreshToken = request.cookies.get('auth_refresh_token')?.value;
  const isAuthenticated = !!refreshToken;

  // Handle protected routes
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated, check if token refresh is needed
    // This is handled client-side in the auth provider
    return NextResponse.next();
  }

  // Handle public auth routes (login, register, etc.)
  if (PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      // User is already authenticated, redirect to dashboard
      const returnTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(returnTo, request.url));
    }
    return NextResponse.next();
  }

  // Handle always accessible routes
  if (ALWAYS_ACCESSIBLE_ROUTES.some((route) => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // For any other routes, allow them through
  // Individual page components will handle their own protection
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
