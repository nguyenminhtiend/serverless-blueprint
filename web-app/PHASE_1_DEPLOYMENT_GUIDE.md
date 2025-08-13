# Phase 1: Infrastructure Updates - Deployment Guide

## Overview
Phase 1 updates your Cognito infrastructure to support OAuth with PKCE flow. This requires a clean deployment (destroy and redeploy) to replace the existing authentication flow with the more secure OAuth approach.

## ✅ Changes Made

### Infrastructure Changes
- ✅ Updated Cognito User Pool Client to use PKCE OAuth flow
- ✅ Disabled password-based authentication flows for security
- ✅ Added environment-specific web app domain configuration
- ✅ Configured OAuth scopes and callback/logout URLs
- ✅ Added new CloudFormation outputs for OAuth endpoints

### Configuration Changes
- ✅ Updated environment configuration to support web app domains
- ✅ Added OAuth-related environment variables to web app
- ✅ Prepared for clean deployment approach

## 🚀 Deployment Steps

### Step 1: Clean Deployment (Destroy and Redeploy)
From your infrastructure directory:

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies (if needed)
npm install

# Destroy all stacks (this will remove all resources)
cdk destroy --all

# Redeploy all stacks with new configuration
# This will create fresh resources with OAuth configuration
cdk deploy --all

# Or deploy specific environment
# cdk deploy --all --context environment=dev
```

**⚠️ Important**: This will destroy and recreate all your infrastructure including:
- Cognito User Pool (users will need to re-register)
- DynamoDB tables (data will be lost unless backed up)
- Lambda functions and API Gateway

### Step 2: Update Environment Variables
After successful deployment, update your web app environment variables:

1. **Get the new Cognito domain from CDK output:**
   Look for `CognitoDomainName` in the deployment output, something like:
   ```
   ServerlessMicroservices-Cognito-dev.CognitoDomainName = dev-serverless-microservices-123456789012
   ```

2. **Update `.env.local`:**
   ```bash
   # Update these lines with the actual values from CDK output
   NEXT_PUBLIC_COGNITO_DOMAIN=dev-serverless-microservices-YOUR-ACCOUNT-ID.auth.ap-southeast-1.amazoncognito.com
   NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=your-new-client-id-from-cdk-output
   
   # Generate a secure auth secret for session encryption
   AUTH_SECRET=$(openssl rand -base64 32)
   ```

3. **For production deployment:**
   - Set `WEB_APP_DOMAIN` environment variable during CDK deployment
   - Update production environment variables accordingly

### Step 3: Verify Deployment
Check that the Cognito User Pool Client now has:

**OAuth Client Configuration:**
- ✅ PKCE enabled (no client secret)
- ✅ Authorization Code Grant enabled
- ✅ Implicit Grant disabled
- ✅ Password auth flows disabled
- ✅ Proper callback/logout URLs configured

## 🔍 Verification Commands

```bash
# Check CDK outputs
cdk list
cdk deploy --outputs-file outputs.json ServerlessMicroservices-Cognito-dev

# Verify in AWS Console
# Go to Cognito User Pool > App Integration > App client settings
# Verify OAuth configuration is correct
```

## 📋 Post-Deployment Checklist

- [ ] Infrastructure deployed successfully (clean deployment)
- [ ] New environment variables updated in `.env.local`
- [ ] Cognito domain name obtained from CDK output
- [ ] AUTH_SECRET generated and configured
- [ ] New client ID updated in environment variables
- [ ] Ready to implement OAuth flow (existing auth disabled)

## 🚨 Important Notes

1. **Breaking Change**: This is a clean deployment that will replace all infrastructure
2. **Data Loss**: All user accounts and data will be lost unless backed up
3. **No Rollback**: Once deployed, you'll need to implement OAuth flow (Phase 2+) for authentication
4. **Next Phase**: Ready to implement PKCE utilities (Phase 2) - existing auth will not work

## 🔧 Environment Variables Summary

### Required for OAuth (Phase 2+):
```env
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.region.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/auth/logout
AUTH_SECRET=your-secure-32-character-string
```

### Existing (still needed):
```env
NEXT_PUBLIC_AWS_REGION=ap-southeast-1
NEXT_PUBLIC_AWS_USER_POOL_ID=your-pool-id
NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=your-client-id
NEXT_PUBLIC_API_GATEWAY_URL=your-api-url
```

## 🎯 Success Criteria

✅ **Infrastructure**: CDK clean deployment completes without errors  
✅ **Configuration**: All environment variables properly set  
✅ **Security**: Password auth flows disabled, PKCE enabled  
✅ **OAuth Ready**: Cognito configured for OAuth + PKCE flow  
✅ **Readiness**: Ready for Phase 2 implementation  

## 📞 Troubleshooting

### Common Issues:

1. **CDK deployment fails**:
   - Check AWS credentials and permissions
   - Verify environment context is set correctly
   - Check for resource conflicts

2. **Environment variables not working**:
   - Restart Next.js dev server after updating `.env.local`
   - Verify no syntax errors in environment file

3. **Cognito domain issues**:
   - Domain names must be globally unique
   - Check if domain prefix is already taken
   - Try adding more unique identifier to domain prefix

### Getting Help:
- Check CDK deployment logs for specific errors
- Verify AWS Console shows updated Cognito configuration
- Test existing login flow to ensure no regression

---

**Ready for Phase 2?** Once deployment is verified, you can proceed with implementing PKCE utilities and OAuth client logic.