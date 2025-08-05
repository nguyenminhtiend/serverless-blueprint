#!/bin/bash

# GitHub OIDC Cleanup Script for AWS
# This script removes OIDC identity provider and IAM roles created for GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Cleaning up GitHub OIDC setup for AWS${NC}"
echo ""

# Get AWS Account ID
echo -e "${YELLOW}📋 Getting AWS Account ID...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo ""

# Function to safely delete role
cleanup_role() {
    local role_name=$1
    
    if ! aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Role ${role_name} does not exist${NC}"
        return
    fi
    
    echo -e "${BLUE}🗑️  Cleaning up role: ${role_name}${NC}"
    
    # Detach managed policies
    echo -e "${BLUE}  📎 Detaching managed policies...${NC}"
    aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].PolicyArn' --output text | \
    while read -r policy_arn; do
        if [ -n "$policy_arn" ]; then
            policy_name=$(basename "$policy_arn")
            echo -e "${BLUE}    🔗 Detaching ${policy_name}...${NC}"
            aws iam detach-role-policy --role-name "$role_name" --policy-arn "$policy_arn"
        fi
    done
    
    # Delete inline policies
    echo -e "${BLUE}  📄 Deleting inline policies...${NC}"
    aws iam list-role-policies --role-name "$role_name" --query 'PolicyNames' --output text | \
    while read -r policy_name; do
        if [ -n "$policy_name" ] && [ "$policy_name" != "None" ]; then
            echo -e "${BLUE}    🗑️  Deleting inline policy: ${policy_name}...${NC}"
            aws iam delete-role-policy --role-name "$role_name" --policy-name "$policy_name"
        fi
    done
    
    # Delete the role
    echo -e "${BLUE}  🗑️  Deleting role...${NC}"
    aws iam delete-role --role-name "$role_name"
    echo -e "${GREEN}  ✅ Role ${role_name} deleted${NC}"
}

# Step 1: Clean up IAM Roles
echo -e "${YELLOW}👥 Cleaning up IAM roles...${NC}"
cleanup_role "GitHubActions-Staging-Role"
cleanup_role "GitHubActions-Production-Role"
echo ""

# Step 2: Clean up OIDC Provider
echo -e "${YELLOW}🔐 Cleaning up OIDC Identity Provider...${NC}"
OIDC_PROVIDER_ARN=$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)].Arn' --output text)

if [ -n "$OIDC_PROVIDER_ARN" ]; then
    echo -e "${BLUE}🗑️  Deleting OIDC provider: ${OIDC_PROVIDER_ARN}${NC}"
    aws iam delete-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN"
    echo -e "${GREEN}✅ OIDC provider deleted${NC}"
else
    echo -e "${YELLOW}⚠️  No OIDC provider found for GitHub Actions${NC}"
fi
echo ""

# Step 3: Clean up custom policy if it exists
echo -e "${YELLOW}📄 Cleaning up custom policies...${NC}"
CUSTOM_POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/CDK-Bootstrap-SSM-Access"

if aws iam get-policy --policy-arn "$CUSTOM_POLICY_ARN" >/dev/null 2>&1; then
    echo -e "${BLUE}🗑️  Deleting custom policy: CDK-Bootstrap-SSM-Access${NC}"
    aws iam delete-policy --policy-arn "$CUSTOM_POLICY_ARN"
    echo -e "${GREEN}✅ Custom policy deleted${NC}"
else
    echo -e "${YELLOW}⚠️  Custom policy CDK-Bootstrap-SSM-Access not found${NC}"
fi
echo ""

echo -e "${GREEN}🎉 GitHub OIDC cleanup complete!${NC}"
echo ""
echo -e "${BLUE}================ CLEANUP SUMMARY =================${NC}"
echo -e "${GREEN}✅ Deleted GitHubActions-Staging-Role${NC}"
echo -e "${GREEN}✅ Deleted GitHubActions-Production-Role${NC}"
echo -e "${GREEN}✅ Deleted OIDC Identity Provider${NC}"
echo -e "${GREEN}✅ Deleted custom policies${NC}"
echo ""
echo -e "${YELLOW}📋 Don't forget to remove these from GitHub:${NC}"
echo -e "${RED}❌ AWS_ROLE_TO_ASSUME_STAGING (secret)${NC}"
echo -e "${RED}❌ AWS_ROLE_TO_ASSUME_PRODUCTION (secret)${NC}"
echo -e "${RED}❌ AWS_ACCOUNT_ID (variable)${NC}"