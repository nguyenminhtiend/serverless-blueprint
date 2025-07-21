#!/bin/bash

# Smart deployment - automatically detects changes and deploys accordingly
set -e

ENVIRONMENT=${1:-dev}
FORCE_FULL=${2:-false}

echo "🧠 Smart deployment for environment: $ENVIRONMENT"

# Check if git is available and we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Not in a git repository. Running full deployment..."
    ./scripts/deploy.sh $ENVIRONMENT full
    exit 0
fi

if [ "$FORCE_FULL" = "true" ] || [ "$FORCE_FULL" = "full" ]; then
    echo "🔄 Full deployment forced..."
    ./scripts/deploy.sh $ENVIRONMENT full
    exit 0
fi

# Get list of changed files since last commit
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
    echo "ℹ️  No changes since last commit. Checking working directory..."
    CHANGED_FILES=$(git diff --name-only 2>/dev/null || echo "")
fi

if [ -z "$CHANGED_FILES" ]; then
    echo "✅ No changes detected. Everything is up to date."
    exit 0
fi

echo "📝 Analyzing changes..."

# Analyze changes
CHANGED_SERVICES=""
INFRASTRUCTURE_CHANGED=false
SHARED_CHANGED=""

for file in $CHANGED_FILES; do
    case $file in
        packages/service-auth/*)
            if [[ ! $CHANGED_SERVICES == *"auth"* ]]; then
                CHANGED_SERVICES="$CHANGED_SERVICES auth"
            fi
            ;;
        packages/service-users/*)
            if [[ ! $CHANGED_SERVICES == *"users"* ]]; then
                CHANGED_SERVICES="$CHANGED_SERVICES users"
            fi
            ;;
        packages/service-orders/*)
            if [[ ! $CHANGED_SERVICES == *"orders"* ]]; then
                CHANGED_SERVICES="$CHANGED_SERVICES orders"
            fi
            ;;
        packages/service-notifications/*)
            if [[ ! $CHANGED_SERVICES == *"notifications"* ]]; then
                CHANGED_SERVICES="$CHANGED_SERVICES notifications"
            fi
            ;;
        packages/shared-*/*)
            echo "📦 Shared package changes detected - using incremental deployment"
            ./scripts/deploy.sh $ENVIRONMENT incremental
            exit 0
            ;;
        infrastructure/*)
            INFRASTRUCTURE_CHANGED=true
            ;;
    esac
done

# Decide deployment strategy
if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    echo "🏗️  Infrastructure changes detected - full deployment required"
    ./scripts/deploy.sh $ENVIRONMENT full
elif [ -n "$CHANGED_SERVICES" ]; then
    SERVICE_COUNT=$(echo $CHANGED_SERVICES | wc -w)
    
    if [ $SERVICE_COUNT -eq 1 ]; then
        SINGLE_SERVICE=$(echo $CHANGED_SERVICES | xargs)
        echo "🎯 Single service changed: $SINGLE_SERVICE"
        echo "🚀 Using fast service-specific deployment..."
        ./scripts/deploy-service.sh $SINGLE_SERVICE $ENVIRONMENT
    else
        echo "🔧 Multiple services changed: $CHANGED_SERVICES"
        echo "🚀 Using incremental deployment..."
        ./scripts/deploy.sh $ENVIRONMENT incremental
    fi
else
    echo "📄 Only config/docs changed - no deployment needed"
    echo "✅ Everything is up to date."
fi