#!/bin/bash

set -e

# Default environment
ENV=${1:-dev}

echo "⚡ Fast deploying Lambda functions for environment: $ENV"
echo "ℹ️  Note: With nested stacks, this deploys the entire main stack (which includes Lambda nested stack)"

# Change to infrastructure directory
cd infrastructure

# Build TypeScript
echo "📦 Building infrastructure..."
npm run build

# Deploy the main stack (nested stack architecture doesn't support partial deployments)
echo "🔄 Deploying main stack (includes Lambda nested stack)..."
cdk deploy serverless-blueprint-$ENV --require-approval never --context environment=$ENV

echo "✅ Infrastructure deployed successfully for environment: $ENV"