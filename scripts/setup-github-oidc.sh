#!/bin/bash

# GitHub OIDC Setup Script for AWS
# This script creates OIDC identity provider, IAM roles, and permissions for GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="${1:-nguyenminhtiend/serverless-blueprint}"
AWS_REGION="${2:-ap-southeast-1}"

echo -e "${BLUE}🚀 Setting up GitHub OIDC for AWS deployment${NC}"
echo -e "${BLUE}Repository: ${GITHUB_REPO}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo ""

# Get AWS Account ID
echo -e "${YELLOW}📋 Getting AWS Account ID...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo ""

# Step 1: Create OIDC Identity Provider
echo -e "${YELLOW}🔐 Setting up OIDC Identity Provider...${NC}"

# Check if OIDC provider already exists
EXISTING_PROVIDER=$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)].Arn' --output text)

if [ -n "$EXISTING_PROVIDER" ]; then
    echo -e "${GREEN}✅ OIDC provider already exists: ${EXISTING_PROVIDER}${NC}"
    OIDC_PROVIDER_ARN="$EXISTING_PROVIDER"
else
    echo -e "${BLUE}Creating OIDC identity provider...${NC}"
    OIDC_PROVIDER_ARN=$(aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
        --client-id-list sts.amazonaws.com \
        --query 'OpenIDConnectProviderArn' --output text)
    echo -e "${GREEN}✅ Created OIDC provider: ${OIDC_PROVIDER_ARN}${NC}"
fi
echo ""

# Step 2: Create Trust Policy Documents
echo -e "${YELLOW}📄 Creating trust policy documents...${NC}"

# Staging Trust Policy
cat > /tmp/staging-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:ref:refs/heads/develop"
        }
      }
    }
  ]
}
EOF

# Production Trust Policy
cat > /tmp/production-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF

# CDK Bootstrap SSM Policy
cat > /tmp/cdk-bootstrap-ssm-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": [
        "arn:aws:ssm:*:${AWS_ACCOUNT_ID}:parameter/cdk-bootstrap/*"
      ]
    }
  ]
}
EOF

echo -e "${GREEN}✅ Trust policy documents created${NC}"
echo ""

# Step 3: Create IAM Roles
echo -e "${YELLOW}👥 Creating IAM roles...${NC}"

# Function to create role if it doesn't exist
create_role_if_not_exists() {
    local role_name=$1
    local trust_policy_file=$2
    local description=$3
    
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Role ${role_name} already exists${NC}"
    else
        echo -e "${BLUE}Creating role: ${role_name}${NC}"
        aws iam create-role \
            --role-name "$role_name" \
            --assume-role-policy-document "file://$trust_policy_file" \
            --description "$description" >/dev/null
        echo -e "${GREEN}✅ Created role: ${role_name}${NC}"
    fi
}

# Create Staging Role
create_role_if_not_exists "GitHubActions-Staging-Role" "/tmp/staging-trust-policy.json" "IAM role for GitHub Actions staging deployments"

# Create Production Role
create_role_if_not_exists "GitHubActions-Production-Role" "/tmp/production-trust-policy.json" "IAM role for GitHub Actions production deployments"

echo ""

# Step 4: Attach Policies to Roles
echo -e "${YELLOW}🔗 Attaching policies to roles...${NC}"

# List of AWS Managed Policies
MANAGED_POLICIES=(
    "arn:aws:iam::aws:policy/AWSCloudFormationFullAccess"
    "arn:aws:iam::aws:policy/IAMFullAccess"
    "arn:aws:iam::aws:policy/AmazonS3FullAccess"
    "arn:aws:iam::aws:policy/AWSLambda_FullAccess"
    "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
    "arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator"
    "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
    "arn:aws:iam::aws:policy/CloudWatchFullAccess"
    "arn:aws:iam::aws:policy/AmazonEventBridgeFullAccess"
    "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
)

# Function to attach policies to a role
attach_policies_to_role() {
    local role_name=$1
    echo -e "${BLUE}Attaching policies to ${role_name}...${NC}"
    
    for policy_arn in "${MANAGED_POLICIES[@]}"; do
        policy_name=$(basename "$policy_arn")
        if aws iam list-attached-role-policies --role-name "$role_name" --query "AttachedPolicies[?PolicyArn=='$policy_arn']" --output text | grep -q "$policy_arn"; then
            echo -e "${GREEN}  ✅ ${policy_name} already attached${NC}"
        else
            echo -e "${BLUE}  📎 Attaching ${policy_name}...${NC}"
            aws iam attach-role-policy --role-name "$role_name" --policy-arn "$policy_arn"
            echo -e "${GREEN}  ✅ Attached ${policy_name}${NC}"
        fi
    done
    
    # Add CDK Bootstrap SSM inline policy
    echo -e "${BLUE}  📎 Adding CDK Bootstrap SSM inline policy...${NC}"
    aws iam put-role-policy \
        --role-name "$role_name" \
        --policy-name "CDK-Bootstrap-SSM" \
        --policy-document "file:///tmp/cdk-bootstrap-ssm-policy.json"
    echo -e "${GREEN}  ✅ Added CDK Bootstrap SSM policy${NC}"
}

# Attach policies to both roles
attach_policies_to_role "GitHubActions-Staging-Role"
echo ""
attach_policies_to_role "GitHubActions-Production-Role"
echo ""

# Step 5: Get Role ARNs
echo -e "${YELLOW}📋 Getting Role ARNs...${NC}"
STAGING_ROLE_ARN=$(aws iam get-role --role-name GitHubActions-Staging-Role --query 'Role.Arn' --output text)
PRODUCTION_ROLE_ARN=$(aws iam get-role --role-name GitHubActions-Production-Role --query 'Role.Arn' --output text)

echo -e "${GREEN}✅ Staging Role ARN: ${STAGING_ROLE_ARN}${NC}"
echo -e "${GREEN}✅ Production Role ARN: ${PRODUCTION_ROLE_ARN}${NC}"
echo ""

# Step 6: Clean up temporary files
echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
rm -f /tmp/staging-trust-policy.json /tmp/production-trust-policy.json /tmp/cdk-bootstrap-ssm-policy.json
echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# Step 7: Display Setup Summary
echo -e "${GREEN}🎉 GitHub OIDC Setup Complete!${NC}"
echo ""
echo -e "${BLUE}================== SETUP SUMMARY ==================${NC}"
echo -e "${YELLOW}AWS Account ID:${NC} ${AWS_ACCOUNT_ID}"
echo -e "${YELLOW}OIDC Provider:${NC} ${OIDC_PROVIDER_ARN}"
echo -e "${YELLOW}Staging Role:${NC} ${STAGING_ROLE_ARN}"
echo -e "${YELLOW}Production Role:${NC} ${PRODUCTION_ROLE_ARN}"
echo ""
echo -e "${BLUE}=============== GITHUB CONFIGURATION ===============${NC}"
echo -e "${YELLOW}Add these to your GitHub repository secrets:${NC}"
echo -e "${GREEN}AWS_ROLE_TO_ASSUME_STAGING=${NC} ${STAGING_ROLE_ARN}"
echo -e "${GREEN}AWS_ROLE_TO_ASSUME_PRODUCTION=${NC} ${PRODUCTION_ROLE_ARN}"
echo ""
echo -e "${YELLOW}Add this to your GitHub repository variables:${NC}"
echo -e "${GREEN}AWS_ACCOUNT_ID=${NC} ${AWS_ACCOUNT_ID}"
echo ""
echo -e "${BLUE}================= BRANCH MAPPING ==================${NC}"
echo -e "${YELLOW}develop branch →${NC} Staging environment"
echo -e "${YELLOW}main branch    →${NC} Production environment"
echo ""
echo -e "${GREEN}✅ Your GitHub Actions CI/CD pipeline is ready!${NC}"