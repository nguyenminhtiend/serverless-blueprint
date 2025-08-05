# GitHub OIDC Setup Scripts

This directory contains scripts to automate the setup and cleanup of GitHub OIDC authentication for AWS deployments.

## Scripts

### `setup-github-oidc.sh`

Automatically sets up the complete GitHub OIDC infrastructure:
- Creates OIDC Identity Provider
- Creates staging and production IAM roles
- Attaches required AWS managed policies
- Adds CDK bootstrap SSM permissions
- Displays configuration for GitHub repository

**Usage:**
```bash
# Use default repository and region
./scripts/setup-github-oidc.sh

# Specify custom repository and region
./scripts/setup-github-oidc.sh "your-org/your-repo" "us-east-1"
```

**Default values:**
- Repository: `nguyenminhtiend/serverless-blueprint`
- Region: `ap-southeast-1`

### `cleanup-github-oidc.sh`

Safely removes all OIDC infrastructure:
- Detaches all policies from roles
- Deletes IAM roles
- Removes OIDC Identity Provider
- Cleans up custom policies

**Usage:**
```bash
./scripts/cleanup-github-oidc.sh
```

## What Gets Created

### OIDC Identity Provider
- URL: `https://token.actions.githubusercontent.com`
- Thumbprint: `6938fd4d98bab03faadb97b34396831e3780aea1`
- Client ID: `sts.amazonaws.com`

### IAM Roles

**GitHubActions-Staging-Role:**
- Trusted by: `develop` branch only
- Purpose: Deploy to staging environment

**GitHubActions-Production-Role:**
- Trusted by: `main` branch only  
- Purpose: Deploy to production environment

### Attached Policies
Both roles get these AWS managed policies:
- `AWSCloudFormationFullAccess`
- `IAMFullAccess`
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonCognitoPowerUser`
- `CloudWatchFullAccess`
- `AmazonEventBridgeFullAccess`
- `AmazonSQSFullAccess`

Plus a custom inline policy for CDK bootstrap SSM access.

## GitHub Configuration

After running the setup script, add these to your GitHub repository:

### Secrets (Settings > Secrets and variables > Actions > Repository secrets)
```
AWS_ROLE_TO_ASSUME_STAGING = arn:aws:iam::ACCOUNT_ID:role/GitHubActions-Staging-Role
AWS_ROLE_TO_ASSUME_PRODUCTION = arn:aws:iam::ACCOUNT_ID:role/GitHubActions-Production-Role
```

### Variables (Settings > Secrets and variables > Actions > Repository variables)
```
AWS_ACCOUNT_ID = YOUR_ACCOUNT_ID
```

## Branch Mapping
- `develop` branch → Staging deployment
- `main` branch → Production deployment

## Security Features
- Branch-specific role restrictions
- No hardcoded AWS credentials
- Minimal required permissions via OIDC
- Automated policy management