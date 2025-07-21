#!/bin/bash

# Reset dev environment - destroy and redeploy all stacks
set -e

ENVIRONMENT="dev"

echo "🔥 Resetting $ENVIRONMENT environment..."

cd infrastructure

echo "📋 Listing current stacks..."
pnpm cdk list -c environment=$ENVIRONMENT || true

echo "💥 Destroying all stacks..."
pnpm cdk destroy --all -c environment=$ENVIRONMENT --force

echo "⏳ Waiting for destruction to complete..."
sleep 10

echo "🏗️  Deploying fresh stacks..."
cd ..
./scripts/deploy.sh $ENVIRONMENT

echo "✅ Environment reset completed!"