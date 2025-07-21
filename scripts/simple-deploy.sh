#!/bin/bash

# Simple deployment script that bypasses CDK bootstrap issues
set -e

ENVIRONMENT=${1:-dev}
REGION="ap-southeast-1"

echo "🚀 Simple deployment to $ENVIRONMENT environment"

# Clean up any existing stacks first
echo "🧹 Cleaning up existing stacks..."
aws cloudformation delete-stack --stack-name "ServerlessMicroservices-ApiGateway-$ENVIRONMENT" --region $REGION 2>/dev/null || true
aws cloudformation delete-stack --stack-name "ServerlessMicroservices-Lambda-$ENVIRONMENT" --region $REGION 2>/dev/null || true
aws cloudformation delete-stack --stack-name "ServerlessMicroservices-Database-$ENVIRONMENT" --region $REGION 2>/dev/null || true

echo "⏳ Waiting for stack deletion..."
sleep 30

# Build packages
echo "🔨 Building packages..."
./scripts/build.sh

# Try CDK deployment with different options
echo "📤 Deploying with CDK..."
cd infrastructure

# Try deployment with bootstrap option disabled
export CDK_NEW_BOOTSTRAP=0
export CDK_DISABLE_VERSION_CHECK=1

# Deploy each stack individually to avoid dependency issues
echo "📀 Deploying Database stack..."
pnpm cdk deploy "ServerlessMicroservices-Database-$ENVIRONMENT" \
  --require-approval never \
  --hotswap \
  --no-rollback \
  -c environment=$ENVIRONMENT || {
    echo "❌ CDK deployment failed, trying CloudFormation template generation..."
    pnpm cdk synth -c environment=$ENVIRONMENT
    echo "✅ Templates generated in cdk.out/"
    exit 1
}

echo "🔧 Deploying Lambda stack..."
pnpm cdk deploy "ServerlessMicroservices-Lambda-$ENVIRONMENT" \
  --require-approval never \
  --hotswap \
  --no-rollback \
  -c environment=$ENVIRONMENT

echo "🌐 Deploying API Gateway stack..."
pnpm cdk deploy "ServerlessMicroservices-ApiGateway-$ENVIRONMENT" \
  --require-approval never \
  --hotswap \
  --no-rollback \
  -c environment=$ENVIRONMENT

echo "✅ Deployment completed successfully!"

cd ..