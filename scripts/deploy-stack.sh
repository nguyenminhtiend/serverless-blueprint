#!/bin/bash

# Deploy specific CDK stack
set -e

STACK_TYPE=$1
ENVIRONMENT=${2:-dev}

if [ -z "$STACK_TYPE" ]; then
    echo "❌ Error: Please specify a stack type to deploy"
    echo "Usage: ./scripts/deploy-stack.sh <stack-type> [environment]"
    echo ""
    echo "Available stack types:"
    echo "  - database"
    echo "  - lambda"
    echo "  - apigateway"
    echo "  - all"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy-stack.sh lambda"
    echo "  ./scripts/deploy-stack.sh apigateway dev"
    echo "  ./scripts/deploy-stack.sh all prod"
    exit 1
fi

# Map stack type to actual stack name
case $STACK_TYPE in
    "database"|"db")
        STACK_NAME="ServerlessMicroservices-Database-$ENVIRONMENT"
        ;;
    "lambda"|"lambdas")
        STACK_NAME="ServerlessMicroservices-Lambda-$ENVIRONMENT"
        ;;
    "apigateway"|"api"|"gateway")
        STACK_NAME="ServerlessMicroservices-ApiGateway-$ENVIRONMENT"
        ;;
    "all")
        STACK_NAME="--all"
        ;;
    *)
        echo "❌ Error: Unknown stack type '$STACK_TYPE'"
        exit 1
        ;;
esac

echo "🚀 Deploying stack: $STACK_TYPE ($STACK_NAME) to environment: $ENVIRONMENT"

# Deploy infrastructure
cd infrastructure

if [ "$ENVIRONMENT" = "dev" ]; then
    echo "🔥 Using hotswap deployment for dev environment..."
    pnpm cdk deploy $STACK_NAME --hotswap --require-approval never -c environment=$ENVIRONMENT
else
    echo "📤 Standard deployment for $ENVIRONMENT environment..."
    pnpm cdk deploy $STACK_NAME --require-approval never -c environment=$ENVIRONMENT
fi

echo "✅ Stack $STACK_TYPE deployed successfully to $ENVIRONMENT!"

cd ..