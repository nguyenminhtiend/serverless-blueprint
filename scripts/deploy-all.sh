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

# Deploy all stacks in order
echo "🏗️  Deploying infrastructure stacks..."
cdk deploy --all --require-approval never --context env=$ENV

echo "✅ All stacks deployed successfully for environment: $ENV"