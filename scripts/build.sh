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

# Build all packages first
echo "🔨 Building packages..."
pnpm build

# Type check all packages
echo "🔍 Type checking..."
pnpm typecheck

# Lint all packages
echo "🧼 Linting..."
pnpm lint

echo "✅ Build completed successfully!"