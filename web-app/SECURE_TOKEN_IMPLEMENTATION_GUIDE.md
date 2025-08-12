# Secure Token Implementation Guide

## 🎯 Goal
Transform current vulnerable client-side token storage to secure server-side implementation with HttpOnly cookies.

## 🏗️ Architecture Overview

### Current (Insecure) Flow
```mermaid
Client → Cognito SDK → Store in SessionStorage → Use Token
```

### Target (Secure) Flow
```mermaid
Client → Server API → Cognito SDK → HttpOnly Cookie → Server Validates
```

## 📝 Implementation Steps

### Step 1: Environment Variables Migration

#### Current (Insecure)
```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_USER_POOL_ID=us-east-1_xxxx
NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=xxxx
```

#### Target (Secure)
```env
# Server-only (no NEXT_PUBLIC prefix)
AWS_REGION=us-east-1
AWS_USER_POOL_ID=us-east-1_xxxx
AWS_USER_POOL_WEB_CLIENT_ID=xxxx

# Optional: Add these for enhanced security
JWT_SECRET=random-32-char-string-here
CSRF_SECRET=another-random-32-char-string
SESSION_SECRET=yet-another-random-string
```

### Step 2: Create Secure Cookie Utilities

**File**: `/app/api/auth/_cookies.ts`
```typescript
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const REFRESH_TOKEN_COOKIE = 'auth-refresh-token';
export const CSRF_TOKEN_COOKIE = 'csrf-token';

export const refreshTokenCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

export const csrfTokenCookieOptions: Partial<ResponseCookie> = {
  httpOnly: false, // Must be readable by client
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 24 * 60 * 60, // 1 day
};
```

### Step 3: CSRF Protection Utilities

**File**: `/app/api/auth/_csrf.ts`
```typescript
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { CSRF_TOKEN_COOKIE, csrfTokenCookieOptions } from './_cookies';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfToken(): string {
  const token = generateCsrfToken();
  cookies().set(CSRF_TOKEN_COOKIE, token, csrfTokenCookieOptions);
  return token;
}

export function validateCsrfToken(request: Request): boolean {
  const cookieToken = cookies().get(CSRF_TOKEN_COOKIE)?.value;
  const headerToken = request.headers.get('X-CSRF-Token');

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

export function requireCsrfToken(request: Request): void {
  if (!validateCsrfToken(request)) {
    throw new Error('Invalid CSRF token');
  }
}
```

### Step 4: Server-Side Cognito Client

**File**: `/app/api/auth/_cognito.ts`
```typescript
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

class SecureCognitoClient {
  private client: CognitoIdentityProviderClient;
  private clientId: string;

  constructor() {
    if (!process.env.AWS_REGION || !process.env.AWS_USER_POOL_WEB_CLIENT_ID) {
      throw new Error('Missing required AWS environment variables');
    }

    this.client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
    this.clientId = process.env.AWS_USER_POOL_WEB_CLIENT_ID;
  }

  async signIn(username: string, password: string) {
    const command = new InitiateAuthCommand({
      ClientId: this.clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    return this.client.send(command);
  }

  async refreshToken(refreshToken: string) {
    const command = new InitiateAuthCommand({
      ClientId: this.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    return this.client.send(command);
  }

  async getUser(accessToken: string) {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    return this.client.send(command);
  }

  async signOut(accessToken: string) {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    return this.client.send(command);
  }

  async signUp(username: string, password: string, attributes: Record<string, string>) {
    const userAttributes = Object.entries(attributes).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));

    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: username,
      Password: password,
      UserAttributes: userAttributes,
    });

    return this.client.send(command);
  }

  async confirmSignUp(username: string, code: string) {
    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: username,
      ConfirmationCode: code,
    });

    return this.client.send(command);
  }
}

export const cognitoClient = new SecureCognitoClient();
```

### Step 5: Secure API Routes

#### Login Route
**File**: `/app/api/auth/login/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cognitoClient } from '../_cognito';
import { setCsrfToken } from '../_csrf';
import { REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions } from '../_cookies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Authenticate with Cognito
    const authResult = await cognitoClient.signIn(email, password);

    if (!authResult.AuthenticationResult) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    const { AccessToken, RefreshToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

    // Get user details
    const userResult = await cognitoClient.getUser(AccessToken!);
    const userAttributes = userResult.UserAttributes || [];

    const user = {
      email: userAttributes.find(attr => attr.Name === 'email')?.Value || '',
      emailVerified: userAttributes.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      firstName: userAttributes.find(attr => attr.Name === 'given_name')?.Value || '',
      lastName: userAttributes.find(attr => attr.Name === 'family_name')?.Value || '',
    };

    // Store refresh token in HttpOnly cookie
    cookies().set(REFRESH_TOKEN_COOKIE, RefreshToken!, refreshTokenCookieOptions);

    // Set CSRF token
    const csrfToken = setCsrfToken();

    // Return access token and user info (NOT refresh token)
    return NextResponse.json({
      user,
      accessToken: AccessToken,
      idToken: IdToken,
      expiresIn: ExpiresIn || 3600,
      csrfToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }
}
```

#### Session Route
**File**: `/app/api/auth/session/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cognitoClient } from '../_cognito';
import { REFRESH_TOKEN_COOKIE } from '../_cookies';

export async function GET(request: NextRequest) {
  try {
    const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json({ user: null });
    }

    // Refresh tokens
    const authResult = await cognitoClient.refreshToken(refreshToken);

    if (!authResult.AuthenticationResult) {
      return NextResponse.json({ user: null });
    }

    const { AccessToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

    // Get user details
    const userResult = await cognitoClient.getUser(AccessToken!);
    const userAttributes = userResult.UserAttributes || [];

    const user = {
      email: userAttributes.find(attr => attr.Name === 'email')?.Value || '',
      emailVerified: userAttributes.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      firstName: userAttributes.find(attr => attr.Name === 'given_name')?.Value || '',
      lastName: userAttributes.find(attr => attr.Name === 'family_name')?.Value || '',
    };

    return NextResponse.json({
      user,
      accessToken: AccessToken,
      idToken: IdToken,
      expiresIn: ExpiresIn || 3600,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
```

#### Refresh Route
**File**: `/app/api/auth/refresh/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cognitoClient } from '../_cognito';
import { requireCsrfToken } from '../_csrf';
import { REFRESH_TOKEN_COOKIE } from '../_cookies';

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    requireCsrfToken(request);

    const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      );
    }

    // Refresh tokens
    const authResult = await cognitoClient.refreshToken(refreshToken);

    if (!authResult.AuthenticationResult) {
      return NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 401 }
      );
    }

    const { AccessToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

    // Get updated user details
    const userResult = await cognitoClient.getUser(AccessToken!);
    const userAttributes = userResult.UserAttributes || [];

    const user = {
      email: userAttributes.find(attr => attr.Name === 'email')?.Value || '',
      emailVerified: userAttributes.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      firstName: userAttributes.find(attr => attr.Name === 'given_name')?.Value || '',
      lastName: userAttributes.find(attr => attr.Name === 'family_name')?.Value || '',
    };

    return NextResponse.json({
      user,
      accessToken: AccessToken,
      idToken: IdToken,
      expiresIn: ExpiresIn || 3600,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 401 }
    );
  }
}
```

#### Logout Route
**File**: `/app/api/auth/logout/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireCsrfToken } from '../_csrf';
import { REFRESH_TOKEN_COOKIE, CSRF_TOKEN_COOKIE } from '../_cookies';

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    requireCsrfToken(request);

    // Clear all auth cookies
    cookies().delete(REFRESH_TOKEN_COOKIE);
    cookies().delete(CSRF_TOKEN_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
```

### Step 6: Update Client Hook

**File**: `/hooks/use-auth.ts`
```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  idToken: string | null;
  loading: boolean;
  error: string | null;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    idToken: null,
    loading: true,
    error: null,
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const csrfTokenRef = useRef<string>('');

  // Get CSRF token from cookie
  const getCsrfToken = useCallback(() => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    return match ? match[1] : '';
  }, []);

  // Initialize session
  const initializeSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to initialize session');
      }

      const data = await response.json();

      if (data.user) {
        setState({
          user: data.user,
          accessToken: data.accessToken,
          idToken: data.idToken,
          loading: false,
          error: null,
        });

        // Schedule token refresh
        scheduleTokenRefresh(data.expiresIn);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to initialize session'
      }));
    }
  }, []);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresIn: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const refreshTime = (expiresIn * 1000) - TOKEN_REFRESH_THRESHOLD;

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const csrfToken = getCsrfToken();
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();

        setState(prev => ({
          ...prev,
          user: data.user,
          accessToken: data.accessToken,
          idToken: data.idToken,
        }));

        // Schedule next refresh
        scheduleTokenRefresh(data.expiresIn);
      } catch (error) {
        // Refresh failed, clear session
        setState({
          user: null,
          accessToken: null,
          idToken: null,
          loading: false,
          error: 'Session expired',
        });
      }
    }, refreshTime);
  }, [getCsrfToken]);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();

      // Store CSRF token reference
      csrfTokenRef.current = data.csrfToken;

      setState({
        user: data.user,
        accessToken: data.accessToken,
        idToken: data.idToken,
        loading: false,
        error: null,
      });

      // Schedule token refresh
      scheduleTokenRefresh(data.expiresIn);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [scheduleTokenRefresh]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const csrfToken = getCsrfToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      setState({
        user: null,
        accessToken: null,
        idToken: null,
        loading: false,
        error: null,
      });
    }
  }, [getCsrfToken]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();

    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [initializeSession]);

  return {
    user: state.user,
    accessToken: state.accessToken,
    idToken: state.idToken,
    loading: state.loading,
    error: state.error,
    signIn,
    signOut,
    refreshToken: async () => {
      const csrfToken = getCsrfToken();
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        user: data.user,
        accessToken: data.accessToken,
        idToken: data.idToken,
      }));
    },
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}
```

### Step 7: Add Security Headers Middleware

**File**: `/middleware.ts`
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HTTPS only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust as needed
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
```

## 🧪 Testing Checklist

### Security Tests
- [ ] Verify refresh token is HttpOnly (not accessible via JavaScript)
- [ ] Test CSRF protection (requests without token should fail)
- [ ] Verify tokens are not in localStorage/sessionStorage
- [ ] Check security headers in response
- [ ] Test XSS protection with payload injection
- [ ] Verify HTTPS redirect in production

### Functional Tests
- [ ] Login creates session with cookies
- [ ] Refresh token updates access token
- [ ] Logout clears all cookies
- [ ] Token auto-refresh before expiry
- [ ] Protected routes require authentication
- [ ] Session persistence across page refresh

### Performance Tests
- [ ] Measure login response time
- [ ] Test concurrent token refreshes
- [ ] Verify no memory leaks with token storage
- [ ] Check cookie size impact

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Remove all NEXT_PUBLIC_AWS_* variables
- [ ] Set secure environment variables
- [ ] Enable HTTPS on hosting platform
- [ ] Configure CORS properly
- [ ] Set up monitoring/alerting

### Post-Deployment
- [ ] Verify HttpOnly cookies in production
- [ ] Test CSP doesn't break functionality
- [ ] Monitor authentication metrics
- [ ] Check for security warnings in console
- [ ] Validate rate limiting works

## 📊 Monitoring & Alerts

### Key Metrics
```typescript
// Track these events
interface SecurityMetrics {
  failedLogins: number;
  tokenRefreshFailures: number;
  csrfViolations: number;
  suspiciousActivities: number;
  sessionHijackAttempts: number;
}
```

### Alert Thresholds
- Failed logins > 5 per minute per IP
- Token refresh failures > 10 per hour
- CSRF violations > 3 per hour
- Multiple concurrent sessions per user
- Login from new geographic location

## 🔒 Additional Security Considerations

### Rate Limiting
```typescript
// Add to API routes
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts',
});
```

### IP Allowlisting (Optional)
```typescript
// For admin routes
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') || [];

export function validateIP(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  return ALLOWED_IPS.includes(ip);
}
```

### Session Fingerprinting
```typescript
// Generate device fingerprint
function getDeviceFingerprint(request: Request): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  return crypto
    .createHash('sha256')
    .update(`${userAgent}${acceptLanguage}${acceptEncoding}`)
    .digest('hex');
}
```

## 📝 Migration Timeline

### Week 1
- Day 1-2: Implement server-side API routes
- Day 3-4: Update client hook and test
- Day 5: Deploy to staging and test

### Week 2
- Day 1-2: Add rate limiting and monitoring
- Day 3-4: Security testing and fixes
- Day 5: Production deployment

### Week 3
- Monitor metrics and alerts
- Fine-tune security policies
- Document lessons learned

---
*Implementation Guide Version: 1.0*
*Last Updated: ${new Date().toISOString()}*
