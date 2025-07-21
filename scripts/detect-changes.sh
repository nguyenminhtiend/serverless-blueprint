#!/bin/bash

# Detect changed services and suggest deployment commands
set -e

ENVIRONMENT=${1:-dev}

echo "🔍 Detecting changed services..."

# Check if git is available and we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Not in a git repository. Cannot detect changes."
    echo "💡 Use: npm run deploy for full deployment"
    exit 1
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

echo "📝 Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""

# Analyze changes and suggest commands
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
        packages/shared-middleware/*)
            if [[ ! $SHARED_CHANGED == *"middleware"* ]]; then
                SHARED_CHANGED="$SHARED_CHANGED middleware"
            fi
            ;;
        packages/shared-core/*)
            if [[ ! $SHARED_CHANGED == *"core"* ]]; then
                SHARED_CHANGED="$SHARED_CHANGED core"
            fi
            ;;
        packages/shared-database/*)
            if [[ ! $SHARED_CHANGED == *"database"* ]]; then
                SHARED_CHANGED="$SHARED_CHANGED database"
            fi
            ;;
        packages/shared-types/*)
            if [[ ! $SHARED_CHANGED == *"types"* ]]; then
                SHARED_CHANGED="$SHARED_CHANGED types"
            fi
            ;;
        infrastructure/*)
            INFRASTRUCTURE_CHANGED=true
            ;;
        scripts/*)
            echo "📜 Build/deployment scripts changed"
            ;;
        *.md|*.json|.*ignore|*.yml|*.yaml)
            echo "📄 Configuration/documentation files changed"
            ;;
    esac
done

# Generate deployment recommendations
echo "🚀 Deployment Recommendations:"
echo "================================"

if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    echo "🏗️  INFRASTRUCTURE CHANGES DETECTED!"
    echo "   Full deployment recommended:"
    echo "   → npm run deploy:$ENVIRONMENT"
    echo ""
fi

if [ -n "$SHARED_CHANGED" ]; then
    echo "📦 SHARED PACKAGES CHANGED:"
    for shared in $SHARED_CHANGED; do
        echo "   - shared-$shared"
    done
    echo ""
    echo "   ⚠️  Shared package changes affect multiple services."
    echo "   Recommended commands:"
    if [[ $SHARED_CHANGED == *"middleware"* ]] || [[ $SHARED_CHANGED == *"core"* ]]; then
        echo "   → npm run deploy:$ENVIRONMENT  # Full deployment (affects all services)"
    else
        echo "   → ./scripts/deploy-service.sh shared-$shared $ENVIRONMENT"
        echo "   → npm run deploy:inc  # Or incremental deployment"
    fi
    echo ""
fi

if [ -n "$CHANGED_SERVICES" ]; then
    echo "🔧 SERVICES CHANGED:"
    SERVICE_COUNT=$(echo $CHANGED_SERVICES | wc -w)
    
    for service in $CHANGED_SERVICES; do
        echo "   - $service"
    done
    echo ""
    
    if [ $SERVICE_COUNT -eq 1 ]; then
        SINGLE_SERVICE=$(echo $CHANGED_SERVICES | xargs)
        echo "   💡 Single service changed. Fast deployment:"
        echo "   → ./scripts/deploy-service.sh $SINGLE_SERVICE $ENVIRONMENT"
        echo ""
    else
        echo "   💡 Multiple services changed. Options:"
        echo "   → npm run deploy:inc  # Incremental (recommended)"
        echo "   → npm run deploy:$ENVIRONMENT  # Full deployment"
        echo ""
        echo "   Or deploy individually:"
        for service in $CHANGED_SERVICES; do
            echo "   → ./scripts/deploy-service.sh $service $ENVIRONMENT"
        done
        echo ""
    fi
fi

# Quick command suggestions
echo "⚡ Quick Commands:"
echo "=================="

if [ -n "$CHANGED_SERVICES" ] && [ -z "$SHARED_CHANGED" ] && [ "$INFRASTRUCTURE_CHANGED" = false ]; then
    SERVICE_COUNT=$(echo $CHANGED_SERVICES | wc -w)
    if [ $SERVICE_COUNT -eq 1 ]; then
        SINGLE_SERVICE=$(echo $CHANGED_SERVICES | xargs)
        echo "🎯 FASTEST: ./scripts/deploy-service.sh $SINGLE_SERVICE $ENVIRONMENT"
        echo "🔧 BUILD ONLY: ./scripts/build-service.sh $SINGLE_SERVICE"
    else
        echo "🚀 FAST: npm run deploy:inc"
        echo "🔧 BUILD ONLY: npm run build:changed"
    fi
else
    echo "🚀 SAFE: npm run deploy:$ENVIRONMENT"
    echo "⚡ FAST: npm run deploy:inc"
fi

echo "🔧 BUILD ONLY: ./scripts/build-incremental.sh"
echo ""

# Show the actual command to copy-paste
if [ -n "$CHANGED_SERVICES" ] && [ -z "$SHARED_CHANGED" ] && [ "$INFRASTRUCTURE_CHANGED" = false ]; then
    SERVICE_COUNT=$(echo $CHANGED_SERVICES | wc -w)
    if [ $SERVICE_COUNT -eq 1 ]; then
        SINGLE_SERVICE=$(echo $CHANGED_SERVICES | xargs)
        echo "💡 Copy-paste ready command:"
        echo "./scripts/deploy-service.sh $SINGLE_SERVICE $ENVIRONMENT"
    fi
fi