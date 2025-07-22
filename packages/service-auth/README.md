# Auth Service - Cognito Integration

This service provides authentication functionality using AWS Cognito User Pools, replacing the previous custom JWT implementation.

## Features

### Core Authentication
- ✅ **User Registration** (`POST /auth/register`)
  - Email-based signup with password validation
  - Optional first name and last name
  - Email verification required

- ✅ **User Login** (`POST /auth/login`)
  - Email and password authentication using SRP flow
  - Returns access, ID, and refresh tokens
  - Handles authentication challenges

- ✅ **Email Confirmation** (`POST /auth/confirm`)
  - Verify email with confirmation code
  - Required after registration

- ✅ **Password Reset** (`POST /auth/forgot-password`, `POST /auth/reset-password`)
  - Request password reset via email
  - Confirm password reset with code

### Admin Operations (Cognito Service)
- Get user details by email or access token
- Update user attributes
- Set/reset user passwords
- Delete users
- List users with filtering

## Environment Variables

Required environment variables for Lambda deployment:

```bash
USER_POOL_ID=us-east-1_xxxxxxxxx    # Cognito User Pool ID
CLIENT_ID=xxxxxxxxxxxxxxxxxx        # Cognito User Pool App Client ID
AWS_REGION=us-east-1                # AWS region
# CLIENT_SECRET not needed for public clients
```

## API Endpoints

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "givenName": "John",      // Optional
  "familyName": "Doe"       // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userSub": "uuid-string",
  "userConfirmed": false,
  "needsConfirmation": true
}
```

### POST /auth/login
Authenticate user and get tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJ...",
    "idToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  }
}
```

### POST /auth/confirm
Confirm email address after registration.

**Request:**
```json
{
  "email": "user@example.com",
  "confirmationCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account confirmed successfully"
}
```

### POST /auth/forgot-password
Request password reset code.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset code sent",
  "deliveryDetails": {
    "DeliveryMedium": "EMAIL",
    "Destination": "u***@e***.com"
  }
}
```

### POST /auth/reset-password
Reset password with confirmation code.

**Request:**
```json
{
  "email": "user@example.com",
  "confirmationCode": "123456",
  "newPassword": "NewSecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

## Security Features

### Password Policy
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Symbols optional (basic setup)

### Token Security
- Access tokens expire in 1 hour
- ID tokens expire in 1 hour
- Refresh tokens expire in 30 days
- All tokens are JWT-based and signed by Cognito

### Account Security
- Email verification required
- Account lockout after failed attempts
- Password reset via secure email delivery
- User existence errors prevented (security best practice)

## Architecture Integration

### Lambda Functions
The service exports individual handlers that can be deployed as separate Lambda functions or combined:

```typescript
// Individual function exports
export { login, register, confirmSignUp, forgotPassword, resetPassword } from '@service/auth';
```

### Middleware Stack
Each handler uses the Pino + Zod middleware stack:
- High-performance Pino logging
- Type-safe Zod validation
- CORS handling
- Error handling with proper status codes

### Infrastructure
Requires CDK stack integration:
- Cognito User Pool and App Client
- Lambda functions with Cognito permissions
- Environment variables from CDK outputs

## Development

### Build
```bash
pnpm build
```

### Test
```bash
pnpm test  # TODO: Add tests
```

### Local Development
Use AWS LocalStack with Cognito local for testing:
```bash
# Configure local Cognito endpoint
export COGNITO_ENDPOINT=http://localhost:4566
```

## Migration from JWT

This service replaces the previous custom JWT implementation:

**Before (Custom JWT):**
- Manual token signing/verification
- Custom user database management
- Manual password hashing
- Custom email verification

**After (Cognito):**
- AWS-managed authentication
- Built-in user management
- Secure password policies
- Integrated email delivery
- JWT tokens issued by AWS
- Native API Gateway integration

## Cost Optimization

**Cognito Pricing:**
- 50,000 MAUs free tier
- $0.0055 per MAU beyond free tier
- SMS/Email delivery charges apply

**Lambda Optimization:**
- ARM64 architecture (20% cost savings)
- Optimized bundle size with Pino
- Efficient Cognito SDK usage
- Minimal memory footprint

## Next Steps

1. **Testing**: Add comprehensive unit and integration tests
2. **MFA**: Enable multi-factor authentication
3. **Social Login**: Add OAuth providers (Google, Facebook, etc.)
4. **Groups & Roles**: Implement Cognito Groups for authorization
5. **Advanced Flows**: Custom authentication challenges
6. **Monitoring**: Add custom metrics and alarms