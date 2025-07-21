#!/bin/bash

# Deployment script
set -e

ENVIRONMENT=${1:-dev}

echo "🚀 Deploying to environment: $ENVIRONMENT"

# Build all packages first
echo "🔨 Building packages..."
./scripts/build.sh

# Deploy infrastructure
echo "🏗️  Deploying infrastructure..."
cd infrastructure

# Deploy all stacks with environment context - try with hotswap for dev
echo "📤 Deploying stacks for $ENVIRONMENT environment..."
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "🔥 Using hotswap deployment for dev..."
    pnpm cdk deploy --verbose --all --require-approval never --hotswap -c environment=$ENVIRONMENT
else
    pnpm cdk deploy --all --require-approval never -c environment=$ENVIRONMENT
fi

echo "✅ Deployment completed successfully!"

cd ..