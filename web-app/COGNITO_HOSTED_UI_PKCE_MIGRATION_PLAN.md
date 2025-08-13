# Cognito Hosted UI + PKCE Migration Plan

## Overview
Migrate from client-side username/password authentication to secure Cognito Hosted UI with Authorization Code + PKCE (S256) flow. This eliminates the need to handle user credentials on the client side and provides better security.

## Current Security Issues
- User credentials (email/password) are handled directly in client-side JavaScript
- Tokens are stored in sessionStorage (better than localStorage but still client-accessible)
- Direct Cognito API calls from browser expose authentication flow details

## Target Architecture
- **Cognito Hosted UI**: AWS-managed authentication pages
- **Authorization Code + PKCE**: OAuth 2.0 flow with Proof Key for Code Exchange
- **Server-side token handling**: Secure cookie-based refresh token storage
- **Client-side access token**: In-memory storage for API calls
- **No client secrets**: PKCE eliminates need for client secrets

## Implementation Phases

### Phase 1: Infrastructure Updates
**Estimated Time: 1-2 hours**

Update Cognito configuration to support Hosted UI and PKCE flow:

#### Tasks:
1. Update `CognitoStack` to configure:
   - Enable PKCE for client
   - Configure proper OAuth scopes
   - Set up callback and logout URLs for all environments
   - Disable password auth flows (keep only authorization code)

2. Add environment-specific configuration:
   - Development: `http://localhost:3000`
   - Staging/Production: actual domain URLs

3. Deploy infrastructure changes
4. Update environment variables in web app

#### Files to modify:
- `infrastructure/lib/stacks/cognito-stack.ts`
- `web-app/.env.local` (for development)

---

### Phase 2: PKCE Utility Implementation
**Estimated Time: 2-3 hours**

Create utility functions for PKCE flow and OAuth URL generation:

#### Tasks:
1. Implement PKCE code verifier/challenge generation
2. Create OAuth URL builder for Cognito Hosted UI
3. Implement authorization code exchange logic
4. Add state parameter validation for CSRF protection

#### New files to create:
- `web-app/src/lib/auth/pkce-utils.ts`
- `web-app/src/lib/auth/oauth-client.ts`
- `web-app/src/lib/auth/auth-config.ts`

#### Key Features:
- Secure random code verifier generation
- SHA256-based code challenge creation
- State parameter generation and validation
- Authorization URL construction
- Token exchange with PKCE verification

---

### Phase 3: Server-side Authentication Routes
**Estimated Time: 3-4 hours**

Implement Next.js API routes to handle OAuth callback and token management:

#### Tasks:
1. Create OAuth callback handler (`/api/auth/callback`)
2. Implement login initiation route (`/api/auth/login`)
3. Add logout handler (`/api/auth/logout`)
4. Create token refresh endpoint (`/api/auth/refresh`)
5. Implement secure cookie management

#### New files to create:
- `web-app/src/app/api/auth/login/route.ts`
- `web-app/src/app/api/auth/callback/route.ts`
- `web-app/src/app/api/auth/logout/route.ts`
- `web-app/src/app/api/auth/refresh/route.ts`
- `web-app/src/lib/auth/cookie-manager.ts`

#### Security Features:
- HttpOnly, Secure, SameSite cookies for refresh tokens
- CSRF protection with state parameter
- Secure session management
- Token validation and verification

---

### Phase 4: Client-side Auth Provider Refactor
**Estimated Time: 4-5 hours**

Update authentication provider to use new OAuth flow:

#### Tasks:
1. Refactor `useAuth` hook for OAuth flow
2. Update authentication context
3. Implement automatic token refresh using server routes
4. Create redirect handling for OAuth callback
5. Add loading states for OAuth redirects

#### Files to modify:
- `web-app/src/hooks/use-auth.ts`
- `web-app/src/components/providers/auth-provider.tsx`
- `web-app/src/lib/auth/secure-storage.ts` (simplified for access tokens only)

#### New approach:
- Access tokens stored in React state (memory only)
- Refresh tokens handled server-side via cookies
- Automatic redirect to Hosted UI for authentication
- Seamless token refresh without user intervention

---

### Phase 5: UI Component Updates
**Estimated Time: 2-3 hours**

Update authentication forms and pages:

#### Tasks:
1. Replace login form with "Sign in with AWS" button
2. Update registration flow to use Hosted UI
3. Remove password handling components
4. Add OAuth callback page
5. Update protected route logic

#### Files to modify:
- `web-app/src/components/forms/login-form.tsx`
- `web-app/src/components/forms/register-form.tsx`
- `web-app/src/app/login/page.tsx`
- `web-app/src/app/register/page.tsx`
- `web-app/src/components/auth/protected-route.tsx`

#### New files to create:
- `web-app/src/app/auth/callback/page.tsx`
- `web-app/src/components/auth/oauth-login-button.tsx`

---

### Phase 6: Middleware and Route Protection
**Estimated Time: 2-3 hours**

Update Next.js middleware for new authentication flow:

#### Tasks:
1. Modify middleware to check server-side authentication
2. Implement automatic token refresh in middleware
3. Add proper redirect handling for unauthenticated users
4. Update protected route patterns

#### Files to modify:
- `web-app/src/middleware.ts`

#### Features:
- Server-side authentication verification
- Automatic redirect to login for protected routes
- Token refresh before expiration
- Proper handling of OAuth callback routes

---

### Phase 7: Legacy Code Cleanup
**Estimated Time: 1-2 hours**

Remove old authentication implementation:

#### Tasks:
1. Remove direct Cognito client usage
2. Delete password-based authentication functions
3. Clean up unused dependencies
4. Update documentation

#### Files to remove/modify:
- `web-app/src/lib/auth/cognito-client.ts` (remove password auth methods)
- Remove unused AWS SDK dependencies
- Update `package.json`

---

### Phase 8: Testing and Security Validation
**Estimated Time: 3-4 hours**

Comprehensive testing of new authentication flow:

#### Tasks:
1. Test complete OAuth flow (login → callback → dashboard)
2. Validate token refresh functionality
3. Test logout and session cleanup
4. Security audit of cookie configuration
5. Cross-browser compatibility testing
6. Mobile responsiveness testing

#### Test scenarios:
- New user registration
- Existing user login
- Token expiration and refresh
- Logout and re-login
- Direct URL access to protected routes
- Browser refresh during authentication
- Multiple tab handling

---

## Security Improvements Achieved

### ✅ Eliminated Client-side Credentials
- No more password handling in JavaScript
- Credentials only exist on AWS-managed Hosted UI pages

### ✅ Secure Token Storage
- Refresh tokens in HttpOnly cookies (server-side only)
- Access tokens in memory (automatic cleanup on page refresh)
- No sensitive data in localStorage/sessionStorage

### ✅ PKCE Protection
- Prevents authorization code interception attacks
- No client secrets required (suitable for SPAs)
- Cryptographically secure code verifier/challenge

### ✅ CSRF Protection
- State parameter validation
- Secure cookie attributes
- Origin validation

### ✅ Reduced Attack Surface
- No direct Cognito API calls from client
- Server-side token validation
- Automatic secure session management

## Migration Risk Assessment

### 🟢 Low Risk
- Infrastructure changes (Cognito configuration)
- New utility functions and API routes
- UI component updates

### 🟡 Medium Risk
- Authentication provider refactor
- Middleware updates
- Legacy code removal

### 🔴 High Risk (Requires careful testing)
- Complete authentication flow replacement
- Session management changes
- Protected route logic

## Rollback Plan

1. Keep current authentication code until Phase 8 completion
2. Feature flag new authentication (environment variable)
3. Database/user data remains unchanged (same Cognito User Pool)
4. Quick revert by switching back to old authentication provider

## Dependencies and Prerequisites

### New NPM packages needed:
```json
{
  "jose": "^5.2.0",          // JWT handling
  "crypto": "built-in"       // PKCE implementation
}
```

### Environment variables to add:
```env
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.region.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
AUTH_SECRET=random-32-character-string-for-session-encryption
```

## Success Metrics

1. **Security**: No credentials stored client-side
2. **User Experience**: Seamless login/logout flow
3. **Performance**: < 2 seconds for authentication redirects
4. **Reliability**: 100% authentication success rate
5. **Compatibility**: Works across all supported browsers

## Next Steps

Ready to start with **Phase 1: Infrastructure Updates**? This involves updating the Cognito stack configuration to support Hosted UI and PKCE flow.