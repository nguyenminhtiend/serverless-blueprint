## Cognito auth hardening checklist (do these in order)

### 0) Move env vars server-side only
- **What**: Stop exposing Cognito config to the browser.
- **Do**:
  - Remove `NEXT_PUBLIC_AWS_REGION` and `NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID` from client-side usage.
  - Add server-only envs (e.g. in `.env.local`, build-time or runtime secrets):
```dotenv
AWS_REGION=your-region-1
AWS_USER_POOL_WEB_CLIENT_ID=your_cognito_app_client_id
```

- Update `web-app/.env.local` to use server-only envs:
```diff
- NEXT_PUBLIC_AWS_REGION=...
- NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=...
+ AWS_REGION=your-region-1
+ AWS_USER_POOL_WEB_CLIENT_ID=your_cognito_app_client_id
```
Note: Keep other `NEXT_PUBLIC_*` (e.g., `NEXT_PUBLIC_API_GATEWAY_URL`) for now; later steps will address them. Do not commit real secrets.

---

### 1) Add API auth utilities (cookies + CSRF)
- **Create**: `web-app/src/app/api/auth/_utils.ts`
```ts
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export function setAuthCookies(opts: { refreshToken: string; refreshTtlSeconds?: number; rotateCsrf?: boolean }) {
  const cookieStore = cookies();
  const refreshMaxAge = opts.refreshTtlSeconds ?? 60 * 60 * 24 * 30; // 30d
  cookieStore.set('rt', opts.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxAge,
  });
  if (opts.rotateCsrf) {
    const csrf = crypto.randomBytes(32).toString('hex');
    cookieStore.set('csrf', csrf, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: refreshMaxAge,
    });
    return csrf;
  }
  return cookies().get('csrf')?.value ?? null;
}

export function clearAuthCookies() {
  const cookieStore = cookies();
  cookieStore.delete('rt');
  cookieStore.delete('csrf');
}

export function assertCsrf(request: Request) {
  const cookieStore = cookies();
  const csrfCookie = cookieStore.get('csrf')?.value;
  const csrfHeader = request.headers.get('x-csrf-token');
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    const e = new Error('CSRF check failed');
    // @ts-expect-error custom status
    e.status = 403;
    throw e;
  }
}
```

---

### 2) Login endpoint (creates HttpOnly refresh cookie, returns access token and profile)
- **Create**: `web-app/src/app/api/auth/login/route.ts`
```ts
import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { setAuthCookies } from '../_utils';

const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.AWS_USER_POOL_WEB_CLIENT_ID!;

const client = new CognitoIdentityProviderClient({ region: REGION });

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const auth = await client.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );

  const result = auth.AuthenticationResult;
  if (!result?.AccessToken || !result.RefreshToken || !result.IdToken) {
    return NextResponse.json({ error: 'Invalid auth response' }, { status: 401 });
  }

  const user = await client.send(new GetUserCommand({ AccessToken: result.AccessToken }));
  const profile = {
    email: user.UserAttributes?.find(a => a.Name === 'email')?.Value ?? '',
    firstName: user.UserAttributes?.find(a => a.Name === 'given_name')?.Value ?? '',
    lastName: user.UserAttributes?.find(a => a.Name === 'family_name')?.Value ?? '',
    emailVerified: user.UserAttributes?.find(a => a.Name === 'email_verified')?.Value === 'true',
  };

  const csrf = setAuthCookies({ refreshToken: result.RefreshToken, rotateCsrf: true });

  return NextResponse.json({
    user: profile,
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    expiresIn: result.ExpiresIn ?? 3600,
    csrfToken: csrf,
  });
}
```

---

### 3) Session endpoint (bootstrap session from refresh cookie)
- **Create**: `web-app/src/app/api/auth/session/route.ts`
```ts
import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';
import { setAuthCookies } from '../_utils';

const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.AWS_USER_POOL_WEB_CLIENT_ID!;
const client = new CognitoIdentityProviderClient({ region: REGION });

export async function GET() {
  const rt = cookies().get('rt')?.value;
  if (!rt) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const auth = await client.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: rt },
    }),
  );

  const result = auth.AuthenticationResult;
  if (!result?.AccessToken || !result.IdToken) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  setAuthCookies({ refreshToken: rt });

  const user = await client.send(new GetUserCommand({ AccessToken: result.AccessToken }));
  const profile = {
    email: user.UserAttributes?.find(a => a.Name === 'email')?.Value ?? '',
    firstName: user.UserAttributes?.find(a => a.Name === 'given_name')?.Value ?? '',
    lastName: user.UserAttributes?.find(a => a.Name === 'family_name')?.Value ?? '',
    emailVerified: user.UserAttributes?.find(a => a.Name === 'email_verified')?.Value === 'true',
  };

  return NextResponse.json({
    user: profile,
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    expiresIn: result.ExpiresIn ?? 3600,
  });
}
```

---

### 4) Refresh endpoint (CSRF-protected; returns fresh access token)
- **Create**: `web-app/src/app/api/auth/refresh/route.ts`
```ts
import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';
import { assertCsrf, setAuthCookies } from '../_utils';

const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.AWS_USER_POOL_WEB_CLIENT_ID!;
const client = new CognitoIdentityProviderClient({ region: REGION });

export async function POST(req: Request) {
  assertCsrf(req);
  const rt = cookies().get('rt')?.value;
  if (!rt) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const auth = await client.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: rt },
    }),
  );

  const result = auth.AuthenticationResult;
  if (!result?.AccessToken || !result.IdToken) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }

  setAuthCookies({ refreshToken: rt });

  const user = await client.send(new GetUserCommand({ AccessToken: result.AccessToken }));

  return NextResponse.json({
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    expiresIn: result.ExpiresIn ?? 3600,
    user: {
      email: user.UserAttributes?.find(a => a.Name === 'email')?.Value ?? '',
      firstName: user.UserAttributes?.find(a => a.Name === 'given_name')?.Value ?? '',
      lastName: user.UserAttributes?.find(a => a.Name === 'family_name')?.Value ?? '',
      emailVerified: user.UserAttributes?.find(a => a.Name === 'email_verified')?.Value === 'true',
    },
  });
}
```

---

### 5) Logout endpoint (CSRF-protected; clears cookies)
- **Create**: `web-app/src/app/api/auth/logout/route.ts`
```ts
import { NextResponse } from 'next/server';
import { assertCsrf, clearAuthCookies } from '../_utils';

export async function POST(req: Request) {
  assertCsrf(req);
  clearAuthCookies();
  return NextResponse.json({ ok: true });
}
```

---

### 6) Sign-up + confirm endpoints (server-side; optional but recommended)
- **Create**: `web-app/src/app/api/auth/signup/route.ts`
```ts
import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.AWS_USER_POOL_WEB_CLIENT_ID!;
const client = new CognitoIdentityProviderClient({ region: REGION });

export async function POST(req: Request) {
  const { email, password, firstName, lastName } = await req.json();

  const res = await client.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
      ],
    }),
  );

  if (!res.UserSub) {
    return NextResponse.json({ error: 'Sign up failed' }, { status: 400 });
  }

  return NextResponse.json({
    userSub: res.UserSub,
    codeDeliveryDetails: res.CodeDeliveryDetails
      ? {
          destination: res.CodeDeliveryDetails.Destination || '',
          deliveryMedium: res.CodeDeliveryDetails.DeliveryMedium || '',
          attributeName: res.CodeDeliveryDetails.AttributeName || '',
        }
      : undefined,
  });
}
```

- **Create**: `web-app/src/app/api/auth/confirm-signup/route.ts`
```ts
import { NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION!;
const CLIENT_ID = process.env.AWS_USER_POOL_WEB_CLIENT_ID!;
const client = new CognitoIdentityProviderClient({ region: REGION });

export async function POST(req: Request) {
  const { email, confirmationCode } = await req.json();

  await client.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    }),
  );

  return NextResponse.json({ ok: true });
}
```

---

### 7) Replace client hook with in-memory tokens (no storage)
- **Delete**: `web-app/src/lib/auth/secure-storage.ts`
- **Stop using**: direct `cognitoAuthClient` on the client.
- **Replace file**: `web-app/src/hooks/use-auth.ts` with the following:
```ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string; // unused on client, kept for type compat
  idToken: string;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

function readCsrfFromCookie(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(c => c.startsWith('csrf='))?.split('=')[1] || '';
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  const setError = useCallback((error: string | null) => setState(prev => ({ ...prev, error })), []);
  const setLoading = useCallback((loading: boolean) => setState(prev => ({ ...prev, loading })), []);

  const setUser = useCallback((user: AuthUser | null) => {
    setState({ user, loading: false, error: null });
  }, []);

  const loadUserFromServer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setUser(null);
        return;
      }
      const user: AuthUser = {
        ...data.user,
        accessToken: data.accessToken,
        refreshToken: '',
        idToken: data.idToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      };
      setUser(user);
    } catch {
      setUser(null);
    }
  }, [setLoading, setUser]);

  const scheduleTokenRefresh = useCallback(
    (expiresAt: number) => {
      const now = Date.now();
      const refreshTime = expiresAt - TOKEN_REFRESH_THRESHOLD;
      if (refreshTime <= now) return;
      const timeout = setTimeout(async () => {
        try {
          const csrf = readCsrfFromCookie();
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'x-csrf-token': csrf },
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok || !data.user) throw new Error(data?.error || 'Refresh failed');
          const updated: AuthUser = {
            ...data.user,
            accessToken: data.accessToken,
            refreshToken: '',
            idToken: data.idToken,
            expiresAt: Date.now() + data.expiresIn * 1000,
          };
          setUser(updated);
          scheduleTokenRefresh(updated.expiresAt);
        } catch {
          setUser(null);
        }
      }, refreshTime - now);
      return () => clearTimeout(timeout);
    },
    [setUser],
  );

  useEffect(() => {
    loadUserFromServer();
  }, [loadUserFromServer]);

  useEffect(() => {
    if (state.user) {
      const cleanup = scheduleTokenRefresh(state.user.expiresAt);
      return cleanup;
    }
  }, [state.user, scheduleTokenRefresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Sign in failed');
        const user: AuthUser = {
          ...data.user,
          accessToken: data.accessToken,
          refreshToken: '',
          idToken: data.idToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };
        setUser(user);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sign in failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setError, setLoading, setUser],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ): Promise<{ requiresConfirmation: boolean; destination?: string }> => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, firstName, lastName }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Sign up failed');
        setLoading(false);
        return {
          requiresConfirmation: !!data.codeDeliveryDetails,
          destination: data.codeDeliveryDetails?.destination,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sign up failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setError, setLoading],
  );

  const confirmSignUp = useCallback(
    async (email: string, confirmationCode: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/auth/confirm-signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, confirmationCode }),
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Email confirmation failed');
        }
        setLoading(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Email confirmation failed';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [setError, setLoading],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const csrf = readCsrfFromCookie();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
        credentials: 'include',
      });
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const refreshToken = useCallback(async (): Promise<void> => {
    if (!state.user) throw new Error('No user');
    try {
      const csrf = readCsrfFromCookie();
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Refresh failed');
      const updated: AuthUser = {
        ...data.user,
        accessToken: data.accessToken,
        refreshToken: '',
        idToken: data.idToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      };
      setUser(updated);
    } catch (e) {
      setUser(null);
      throw e;
    }
  }, [state.user, setUser]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    refreshToken,
    clearError: () => setError(null),
  };
}
```

---

### 8) Update forms (no changes needed)
- Your forms call the same `useAuth` methods; after replacing the hook they will use the new endpoints automatically.

---

### 9) Optional: BFF pattern (never expose access tokens)
- Proxy downstream API calls via Next.js route handlers and attach `Authorization` server-side using the refresh cookie. Then remove `accessToken` usage from the browser entirely.

---

### 10) Add CSP (recommended)
- Add a strict Content Security Policy to reduce XSS risk. Example header:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'
```
Adjust as needed for your assets.

---

### 11) Test checklist
- Sign up → receive code → confirm.
- Login → expect `rt` and `csrf` cookies set (HttpOnly for `rt`).
- Refresh (wait close to expiry) → still authenticated.
- Logout → cookies cleared; session endpoint returns `{ user: null }`.

---

### 12) Cleanup
- Remove `web-app/src/lib/auth/secure-storage.ts` and any dead imports.
- Ensure no `NEXT_PUBLIC_AWS_*` are used client-side.

---

### Notes
- Cognito does not return a rotated refresh token on refresh by default; cookie is kept as-is and its Max-Age refreshed.
- If you enable RT rotation in Cognito, update the refresh endpoint to set the new token.


