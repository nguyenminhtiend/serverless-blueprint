#!/bin/bash

set -e

# Check if stack name is provided
if [ -z "$1" ]; then
    echo "❌ Error: Stack name is required"
    echo "Usage: $0 <stack-name> [environment]"
    echo ""
    echo "Available stacks:"
    echo "  - Database"
    echo "  - Cognito" 
    echo "  - Events"
    echo "  - Lambda"
    echo "  - ApiGateway"
    echo ""
    echo "Example: $0 Database dev"
    exit 1
fi

STACK_NAME=$1
ENV=${2:-dev}

echo "🏗️  Deploying $STACK_NAME stack for environment: $ENV"

# Change to infrastructure directory
cd infrastructure

# Build TypeScript
echo "📦 Building infrastructure..."
npm run build

# Deploy specific stack
echo "🚀 Deploying ServerlessMicroservices-$STACK_NAME-$ENV..."
cdk deploy ServerlessMicroservices-$STACK_NAME-$ENV --require-approval never --context env=$ENV

echo "✅ $STACK_NAME stack deployed successfully for environment: $ENV"