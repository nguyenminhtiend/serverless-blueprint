#!/bin/bash

# Selective build script for individual services
set -e

SERVICE=$1
ENVIRONMENT=${2:-dev}

if [ -z "$SERVICE" ]; then
    echo "❌ Error: Please specify a service to build"
    echo "Usage: ./scripts/build-service.sh <service-name> [environment]"
    echo ""
    echo "Available services:"
    echo "  - auth"
    echo "  - users"
    echo "  - orders"
    echo "  - notifications"
    echo "  - shared-middleware"
    echo "  - shared-core"
    echo "  - shared-database"
    echo "  - shared-types"
    echo ""
    echo "Examples:"
    echo "  ./scripts/build-service.sh auth"
    echo "  ./scripts/build-service.sh shared-middleware dev"
    exit 1
fi

# Map service names to package names
case $SERVICE in
    "auth")
        PACKAGE_NAME="service-auth"
        ;;
    "users")
        PACKAGE_NAME="service-users"
        ;;
    "orders")
        PACKAGE_NAME="service-orders"
        ;;
    "notifications")
        PACKAGE_NAME="service-notifications"
        ;;
    "shared-middleware"|"middleware")
        PACKAGE_NAME="shared-middleware"
        ;;
    "shared-core"|"core")
        PACKAGE_NAME="shared-core"
        ;;
    "shared-database"|"database")
        PACKAGE_NAME="shared-database"
        ;;
    "shared-types"|"types")
        PACKAGE_NAME="shared-types"
        ;;
    *)
        echo "❌ Error: Unknown service '$SERVICE'"
        exit 1
        ;;
esac

PACKAGE_PATH="packages/$PACKAGE_NAME"

if [ ! -d "$PACKAGE_PATH" ]; then
    echo "❌ Error: Package directory '$PACKAGE_PATH' not found"
    exit 1
fi

echo "🔨 Building service: $SERVICE ($PACKAGE_NAME)"

# Build dependencies first if they exist
if [ -f "$PACKAGE_PATH/package.json" ]; then
    DEPENDENCIES=$(cat "$PACKAGE_PATH/package.json" | grep -o '"@shared/[^"]*"' | sed 's/"@shared\///g' | sed 's/"//g' || true)
    
    if [ -n "$DEPENDENCIES" ]; then
        echo "📦 Building dependencies first..."
        for dep in $DEPENDENCIES; do
            if [ -d "packages/shared-$dep" ]; then
                echo "  - Building shared-$dep..."
                cd "packages/shared-$dep"
                pnpm run build
                cd ../..
            fi
        done
    fi
fi

# Build the target service
echo "🔨 Building $PACKAGE_NAME..."
cd "$PACKAGE_PATH"
pnpm run build
cd ../..

echo "✅ Service $SERVICE built successfully!"