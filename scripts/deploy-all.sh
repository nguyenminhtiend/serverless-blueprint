#!/bin/bash

set -e

# Default environment
ENV=${1:-dev}

echo "🚀 Deploying all stacks for environment: $ENV"

# Change to infrastructure directory
cd infrastructure

# Build TypeScript
echo "📦 Building infrastructure..."
npm run build

# Bootstrap CDK if needed (will skip if already bootstrapped)
echo "🔧 Ensuring CDK is bootstrapped..."
cdk bootstrap

# Deploy the main stack (which contains all nested stacks)
echo "🏗️  Deploying infrastructure stacks..."
cdk deploy serverless-blueprint-$ENV --require-approval never --context environment=$ENV

echo "✅ All stacks deployed successfully for environment: $ENV"