#!/bin/bash

set -e

# Default environment
ENV=${1:-dev}

echo "⚡ Fast deploying Lambda functions for environment: $ENV"

# Change to infrastructure directory
cd infrastructure

# Build TypeScript
echo "📦 Building infrastructure..."
npm run build

# Only deploy Lambda stack (contains all Lambda functions)
echo "🔄 Deploying Lambda stack..."
cdk deploy ServerlessMicroservices-Lambda-$ENV --require-approval never --context env=$ENV

echo "✅ Lambda functions deployed successfully for environment: $ENV"