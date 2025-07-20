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

# Bootstrap CDK if needed
if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "🥾 Bootstrapping CDK..."
    pnpm cdk bootstrap
fi

# Deploy all stacks
echo "📤 Deploying stacks..."
pnpm cdk deploy --all --require-approval never

echo "✅ Deployment completed successfully!"

cd ..