#!/bin/bash

# Deploy Monitoring Stack for Serverless Microservices
# Usage: ./deploy-monitoring.sh [environment] [alert-email]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-dev}
ALERT_EMAIL=${2}
AWS_REGION=${AWS_REGION:-ap-southeast-1}

echo -e "${BLUE}🚀 Deploying Monitoring Stack for Serverless Microservices${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"

if [ -n "$ALERT_EMAIL" ]; then
    echo -e "${BLUE}Alert Email: ${ALERT_EMAIL}${NC}"
fi

# Check if we're in the right directory
if [ ! -f "infrastructure/cdk.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CDK is not installed${NC}"
    echo -e "${YELLOW}Install with: npm install -g aws-cdk${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
    echo -e "${YELLOW}Configure with: aws configure${NC}"
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}AWS Account: ${ACCOUNT_ID}${NC}"

# Change to infrastructure directory
cd infrastructure

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install

echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
pnpm run build

echo -e "${YELLOW}🔍 Checking for CDK bootstrap...${NC}"
# Check if CDK is bootstrapped
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
    echo -e "${YELLOW}🚀 Bootstrapping CDK...${NC}"
    cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION
fi

# Prepare CDK context
CDK_CONTEXT="--context environment=$ENVIRONMENT --context account=$ACCOUNT_ID --context region=$AWS_REGION"

if [ -n "$ALERT_EMAIL" ]; then
    CDK_CONTEXT="$CDK_CONTEXT --context alertEmail=$ALERT_EMAIL"
fi

echo -e "${YELLOW}📋 Running CDK diff for monitoring stack...${NC}"
cdk diff "ServerlessMicroservices-Monitoring-$ENVIRONMENT" $CDK_CONTEXT

echo -e "${YELLOW}🚀 Deploying monitoring stack...${NC}"

# Deploy only the monitoring stack
cdk deploy "ServerlessMicroservices-Monitoring-$ENVIRONMENT" \
    $CDK_CONTEXT \
    --require-approval never \
    --progress events \
    --outputs-file monitoring-outputs.json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Monitoring stack deployed successfully!${NC}"

    # Display important outputs
    if [ -f "monitoring-outputs.json" ]; then
        echo -e "${BLUE}📊 Monitoring Resources:${NC}"

        # Extract dashboard URLs if available
        OVERVIEW_DASHBOARD=$(cat monitoring-outputs.json | jq -r ".[\"ServerlessMicroservices-Monitoring-$ENVIRONMENT\"].ServiceOverviewDashboardURL // empty")
        BUSINESS_DASHBOARD=$(cat monitoring-outputs.json | jq -r ".[\"ServerlessMicroservices-Monitoring-$ENVIRONMENT\"].BusinessMetricsDashboardURL // empty")

        if [ -n "$OVERVIEW_DASHBOARD" ]; then
            echo -e "${GREEN}🎯 Service Overview Dashboard: $OVERVIEW_DASHBOARD${NC}"
        fi

        if [ -n "$BUSINESS_DASHBOARD" ]; then
            echo -e "${GREEN}📈 Business Metrics Dashboard: $BUSINESS_DASHBOARD${NC}"
        fi

        # Show SNS topic ARNs
        echo -e "${BLUE}📧 Alert Topics:${NC}"
        echo -e "${GREEN}Critical: arn:aws:sns:$AWS_REGION:$ACCOUNT_ID:serverless-critical-$ENVIRONMENT${NC}"
        echo -e "${GREEN}Warning: arn:aws:sns:$AWS_REGION:$ACCOUNT_ID:serverless-warning-$ENVIRONMENT${NC}"
    fi

    echo -e "${BLUE}🎯 Next Steps:${NC}"
    echo -e "${YELLOW}1. Open CloudWatch Console to view dashboards${NC}"
    echo -e "${YELLOW}2. Run the verification script: ../testing/verify-monitoring.sh${NC}"
    echo -e "${YELLOW}3. Test alarm triggers with sample errors${NC}"
    echo -e "${YELLOW}4. Configure SNS subscriptions for alerts${NC}"

    if [ -n "$ALERT_EMAIL" ]; then
        echo -e "${YELLOW}5. Check your email ($ALERT_EMAIL) for SNS subscription confirmations${NC}"
    fi

else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}🎉 Monitoring deployment complete!${NC}"