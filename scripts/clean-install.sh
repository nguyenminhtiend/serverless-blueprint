#!/bin/bash

set -e

echo "🧹 Cleaning all node_modules and reinstalling dependencies..."

# Remove all node_modules directories recursively
echo "Removing all node_modules directories..."
find . -name "node_modules" -type d -prune -exec rm -rf {} \;

# Remove pnpm-lock.yaml to force fresh resolution
echo "Removing pnpm-lock.yaml..."
rm -f pnpm-lock.yaml

# Clear pnpm store cache
echo "Clearing pnpm store cache..."
pnpm store prune

# Install all dependencies from scratch
echo "Installing all dependencies..."
pnpm install

echo "✅ Clean install completed successfully!"