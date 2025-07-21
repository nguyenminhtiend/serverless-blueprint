#!/bin/bash

# Incremental build script - only builds changed packages
set -e

ENVIRONMENT=${1:-dev}

echo "🔨 Running incremental build..."

# Check if git is available and we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Not in a git repository. Running full build..."
    pnpm build
    exit 0
fi

# Get list of changed files since last commit
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
    echo "ℹ️  No changes detected since last commit. Checking working directory..."
    CHANGED_FILES=$(git diff --name-only 2>/dev/null || echo "")
fi

if [ -z "$CHANGED_FILES" ]; then
    echo "ℹ️  No changes detected. Build up to date."
    exit 0
fi

echo "📝 Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  - /'

# Extract unique packages that need rebuilding
PACKAGES_TO_BUILD=""

for file in $CHANGED_FILES; do
    if [[ $file == packages/* ]]; then
        # Extract package name from path (e.g., packages/service-auth/src/index.ts -> service-auth)
        PACKAGE=$(echo $file | cut -d'/' -f2)
        if [[ ! $PACKAGES_TO_BUILD == *"$PACKAGE"* ]]; then
            PACKAGES_TO_BUILD="$PACKAGES_TO_BUILD $PACKAGE"
        fi
    elif [[ $file == infrastructure/* ]]; then
        echo "🏗️  Infrastructure changes detected - will need full redeploy"
        PACKAGES_TO_BUILD="infrastructure $PACKAGES_TO_BUILD"
    fi
done

if [ -z "$PACKAGES_TO_BUILD" ]; then
    echo "ℹ️  No package changes detected. Build up to date."
    exit 0
fi

echo "🔨 Packages to rebuild:$PACKAGES_TO_BUILD"

# Build each changed package and its dependencies
for package in $PACKAGES_TO_BUILD; do
    if [ "$package" = "infrastructure" ]; then
        echo "🏗️  Building infrastructure..."
        cd infrastructure
        pnpm run build
        cd ..
    elif [ -d "packages/$package" ]; then
        echo "📦 Building package: $package"
        
        # Build dependencies first
        cd "packages/$package"
        if [ -f "package.json" ]; then
            DEPENDENCIES=$(cat package.json | grep -o '"@shared/[^"]*"' | sed 's/"@shared\///g' | sed 's/"//g' || true)
            
            if [ -n "$DEPENDENCIES" ]; then
                echo "  📦 Building dependencies..."
                for dep in $DEPENDENCIES; do
                    if [ -d "../shared-$dep" ]; then
                        echo "    - Building shared-$dep..."
                        cd "../shared-$dep"
                        pnpm run build
                        cd "../$package"
                    fi
                done
            fi
        fi
        
        # Build the package
        pnpm run build
        cd ../..
    fi
done

echo "✅ Incremental build completed!"