#!/bin/bash

# Test script for all packages
set -e

echo "🧪 Running all tests..."

# Run unit tests
echo "🔬 Running unit tests..."
pnpm test

# Run lint
echo "🧼 Running linter..."
pnpm lint

# Type check
echo "🔍 Type checking..."
pnpm typecheck

echo "✅ All tests passed!"