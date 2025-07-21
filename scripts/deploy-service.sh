#!/bin/bash

# Selective deployment script for individual services
set -e

SERVICE=$1
ENVIRONMENT=${2:-dev}

if [ -z "$SERVICE" ]; then
    echo "❌ Error: Please specify a service to deploy"
    echo "Usage: ./scripts/deploy-service.sh <service-name> [environment]"
    echo ""
    echo "Available services:"
    echo "  - auth"
    echo "  - users"
    echo "  - orders"
    echo "  - notifications"
    echo "  - shared-middleware (affects all services that use it)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy-service.sh auth"
    echo "  ./scripts/deploy-service.sh users dev"
    echo "  ./scripts/deploy-service.sh shared-middleware prod"
    exit 1
fi

echo "🚀 Deploying service: $SERVICE to environment: $ENVIRONMENT"

# Build only the required service and its dependencies
echo "🔨 Building service: $SERVICE"
./scripts/build-service.sh $SERVICE $ENVIRONMENT

# Map service to CDK stack names
case $SERVICE in
    "auth"|"users"|"orders"|"notifications")
        STACK_NAME="ServerlessMicroservices-Lambda-$ENVIRONMENT"
        ;;
    "shared-middleware")
        echo "⚠️  Shared middleware affects all services. Full deployment recommended."
        STACK_NAME="ServerlessMicroservices-Lambda-$ENVIRONMENT"
        ;;
    *)
        echo "❌ Error: Service '$SERVICE' is not deployable (shared libraries are built into other services)"
        exit 1
        ;;
esac

# Deploy infrastructure with hotswap for faster lambda updates
echo "🏗️  Deploying infrastructure for $SERVICE..."
cd infrastructure

if [ "$ENVIRONMENT" = "dev" ]; then
    echo "🔥 Using hotswap deployment for dev environment..."
    pnpm cdk deploy $STACK_NAME --hotswap --require-approval never -c environment=$ENVIRONMENT
else
    echo "📤 Standard deployment for $ENVIRONMENT environment..."
    pnpm cdk deploy $STACK_NAME --require-approval never -c environment=$ENVIRONMENT
fi

echo "✅ Service $SERVICE deployed successfully to $ENVIRONMENT!"

cd ..