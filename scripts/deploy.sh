#!/bin/bash

# Deployment script
set -e

ENVIRONMENT=${1:-dev}
BUILD_MODE=${2:-full}

echo "🚀 Deploying to environment: $ENVIRONMENT (build mode: $BUILD_MODE)"

# Choose build strategy
case $BUILD_MODE in
    "incremental"|"inc")
        echo "🔨 Running incremental build..."
        ./scripts/build-incremental.sh $ENVIRONMENT
        ;;
    "full"|*)
        echo "🔨 Running full build..."
        ./scripts/build.sh
        ;;
esac

# Deploy infrastructure
echo "🏗️  Deploying infrastructure..."
cd infrastructure

# Deploy all stacks with environment context
echo "📤 Deploying stacks for $ENVIRONMENT environment..."
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "🔥 Using hotswap deployment for dev..."
    pnpm cdk deploy --hotswap --all --require-approval never -c environment=$ENVIRONMENT
else
    pnpm cdk deploy --all --require-approval never -c environment=$ENVIRONMENT
fi

echo "✅ Deployment completed successfully!"

cd ..