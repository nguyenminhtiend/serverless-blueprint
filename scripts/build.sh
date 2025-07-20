#!/bin/bash

# Build script for all packages
set -e

echo "🔨 Building all packages..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
pnpm clean

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Type check all packages
echo "🔍 Type checking..."
pnpm typecheck

# Lint all packages
echo "🧼 Linting..."
pnpm lint

# Build all packages
echo "🔨 Building packages..."
pnpm build

echo "✅ Build completed successfully!"