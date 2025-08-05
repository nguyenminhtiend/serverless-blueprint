# Phase 12: CI/CD Pipeline - Simplified Implementation Plan

## Overview
This phase establishes a simple, secure CI/CD pipeline using GitHub Actions with OIDC authentication to automate testing, building, and deployment of the serverless microservices architecture.

## 12.1: GitHub Actions Workflow Foundation

### Core Workflow Structure
Create `.github/workflows/main.yml` with the following components:

```yaml
name: Serverless Microservices CI/CD Pipeline

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
  AWS_REGION: 'ap-southeast-1'

jobs:
  # Job definitions follow below
```

### OIDC Configuration & Secrets
Required GitHub Secrets:
- `AWS_ROLE_TO_ASSUME_STAGING` (IAM Role ARN for staging)
- `AWS_ROLE_TO_ASSUME_PRODUCTION` (IAM Role ARN for production)

Required GitHub Variables:
- `AWS_ACCOUNT_ID`

## 12.2: Simplified Pipeline Jobs

### Stage 1: Test & Build
```yaml
  test-and-build:
    name: Test and Build
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm run test:unit

      - name: Build all packages
        run: pnpm run build

      - name: Generate version
        id: version
        run: |
          VERSION=$(date +%Y.%m.%d)-${{ github.run_number }}
          echo "version=$VERSION" >> $GITHUB_OUTPUT
```

## 12.3: Environment-Specific Deployment Jobs

### Staging Deployment (Develop Branch)
```yaml
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: test-and-build
    if: github.ref == 'refs/heads/develop'
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials using OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js & pnpm
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm run build

      - name: Deploy to staging
        run: |
          cd infrastructure
          pnpm cdk bootstrap
          pnpm cdk deploy --all --require-approval never
        env:
          CDK_DEFAULT_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: ${{ env.AWS_REGION }}
```

### Production Deployment (Master Branch)
```yaml
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: test-and-build
    if: github.ref == 'refs/heads/master'
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials using OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_PRODUCTION }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js & pnpm
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm run build

      - name: Deploy to production
        run: |
          cd infrastructure
          pnpm cdk bootstrap
          pnpm cdk deploy --all --require-approval never
        env:
          CDK_DEFAULT_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: ${{ env.AWS_REGION }}
```

## 12.4: AWS OIDC Setup

### Required AWS IAM Configuration

#### 1. Create OIDC Identity Provider
```bash
# Create OIDC identity provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com
```

#### 2. Create IAM Roles for Environments

**Staging Role (`GitHubActions-Staging-Role`)**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/develop"
        }
      }
    }
  ]
}
```

**Production Role (`GitHubActions-Production-Role`)**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/master"
        }
      }
    }
  ]
}
```

#### 3. Attach Policies to Roles
Both roles need the following managed policies:
- `AWSCloudFormationFullAccess`
- `IAMFullAccess`
- `AmazonS3FullAccess`
- `AWSLambdaFullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonCognitoPowerUser`
- `CloudWatchFullAccess`
- `AmazonEventBridgeFullAccess`
- `AmazonSQSFullAccess`

## 12.5: Complete GitHub Actions Workflow

### `.github/workflows/main.yml`
```yaml
name: Serverless Microservices CI/CD Pipeline

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
  AWS_REGION: 'ap-southeast-1'

jobs:
  test-and-build:
    name: Test and Build
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm run test:unit

      - name: Build all packages
        run: pnpm run build

      - name: Generate version
        id: version
        run: |
          VERSION=$(date +%Y.%m.%d)-${{ github.run_number }}
          echo "version=$VERSION" >> $GITHUB_OUTPUT

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: test-and-build
    if: github.ref == 'refs/heads/develop'
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials using OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js & pnpm
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm run build

      - name: Deploy to staging
        run: |
          cd infrastructure
          pnpm cdk bootstrap
          pnpm cdk deploy --all --require-approval never
        env:
          CDK_DEFAULT_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: ${{ env.AWS_REGION }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: test-and-build
    if: github.ref == 'refs/heads/master'
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials using OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_PRODUCTION }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js & pnpm
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm run build

      - name: Deploy to production
        run: |
          cd infrastructure
          pnpm cdk bootstrap
          pnpm cdk deploy --all --require-approval never
        env:
          CDK_DEFAULT_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: ${{ env.AWS_REGION }}
```

## 12.6: Configuration Files

### Package.json Scripts
```json
{
  "scripts": {
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "format:check": "prettier --check .",
    "format:fix": "prettier --write ."
  }
}
```

## 12.7: Implementation Checklist

### Phase 12.1: Setup OIDC Authentication
- [ ] Create OIDC identity provider in AWS
- [ ] Create IAM roles for staging and production
- [ ] Configure trust policies for GitHub branches
- [ ] Add required GitHub secrets and variables

### Phase 12.2: Create GitHub Actions Workflow
- [ ] Create `.github/workflows/main.yml` file
- [ ] Configure unit testing job
- [ ] Set up build job
- [ ] Configure staging deployment (develop branch)
- [ ] Configure production deployment (master branch)

### Phase 12.3: Test & Deploy
- [ ] Test pipeline with develop branch push
- [ ] Verify staging deployment works
- [ ] Test pipeline with master branch push  
- [ ] Verify production deployment works
- [ ] Confirm CDK state is stored in S3

## 12.8: Success Metrics

**Phase 12 Complete When:**
- [ ] OIDC authentication is configured and working
- [ ] Unit tests run automatically on every push
- [ ] Staging deploys automatically from develop branch
- [ ] Production deploys automatically from master branch
- [ ] CDK bootstrap and deploy work without manual intervention
- [ ] No hardcoded AWS credentials in the pipeline

**Expected Outcomes:**
- **Security**: No AWS credentials stored in GitHub
- **Automation**: Fully automated deployment process
- **Simplicity**: Minimal, maintainable pipeline configuration
- **Reliability**: Consistent deployments using CDK state in S3

## 12.9: Future Enhancements

When the basic pipeline is working, consider adding:
- Slack notifications for deployment status
- Manual approval step for production deployments
- Integration tests with AWS LocalStack
- Code coverage reporting
- Linting and formatting checks

This simplified CI/CD pipeline provides secure, automated deployment while keeping complexity to a minimum.