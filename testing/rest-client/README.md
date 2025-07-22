# REST Client Testing

## Setup

1. **Install VS Code Extension**: `REST Client` by Huachao Mao
2. **Copy the template**: 
   ```bash
   cp phase7-auth.http.example phase7-auth.http
   ```
3. **Update variables** in your `phase7-auth.http`:
   - Change `@test_email` to your actual email
   - Change `@test_password` to your test password
   - Update JWT tokens as needed

## Usage

1. Open `phase7-auth.http` in VS Code
2. Click "Send Request" above each HTTP request
3. Copy JWT tokens from login response to test protected routes

## Security

- `*.http` files are gitignored to prevent sensitive data commits
- Only `*.http.example` template files are tracked in git
- Never commit files containing real JWT tokens or personal emails

## Available Tests

- ✅ User registration
- ✅ Email confirmation  
- ✅ User login (JWT tokens)
- ✅ Protected route testing
- ✅ Password reset flow
- ✅ Error case testing