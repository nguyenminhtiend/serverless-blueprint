# Simplified Deployment Guide

## Overview

The deployment system has been simplified with smart scripts that automatically detect changes and deploy only what's needed. This separates **infrastructure** deployment from **service** deployment for faster iterations.

## Quick Commands

### 🏗️ Infrastructure Deployment
```bash
# Auto-detect and deploy changed infrastructure
pnpm deploy:infra          # Deploy to dev
pnpm deploy:infra:prod     # Deploy to prod

# Deploy specific stacks
pnpm deploy:db             # Database stack only
pnpm deploy:auth           # Cognito authentication stack only
pnpm deploy:api            # API Gateway stack only
pnpm deploy:lambda         # Lambda functions stack only
```

### 🚀 Service Deployment (Fast)
```bash
# Auto-detect and deploy changed services
pnpm deploy:services       # Deploy to dev
pnpm deploy:services:prod  # Deploy to prod

# Deploy specific services
pnpm deploy:service:auth   # Auth service only
pnpm deploy:service:users  # Users service only
pnpm deploy:service:orders # Orders service only
```

### 📋 Utilities
```bash
pnpm diff                  # Show infrastructure changes
pnpm synth                 # Synthesize stacks (check for errors)
pnpm typecheck             # Type check all packages
pnpm build                 # Build all packages
```

## Smart Change Detection

### Infrastructure Changes Auto-Deploy:
- ✅ `infrastructure/lib/*-stack.ts` → Specific stack
- ✅ `infrastructure/bin/app.ts` → All stacks
- ✅ `packages/shared-*` → Database + Lambda stacks

### Service Changes Auto-Deploy:
- ✅ `packages/service-auth/` → Auth service
- ✅ `packages/service-users/` → Users service  
- ✅ `packages/service-orders/` → Orders service
- ✅ `packages/shared-*` → All services

## Deployment Flow

### 1. First Time Setup
```bash
# Bootstrap CDK (one time)
pnpm bootstrap

# Deploy all infrastructure
pnpm deploy:infra:dev all
```

### 2. Daily Development
```bash
# After code changes, auto-detect and deploy
pnpm deploy:services        # Fast service updates
pnpm deploy:infra          # Only if infrastructure changed
```

### 3. Production Deployment
```bash
# Show what will change first
pnpm diff

# Deploy with confirmation
pnpm deploy:infra:prod     # Infrastructure first
pnpm deploy:services:prod  # Services second
```

## Key Benefits

### ⚡ **Speed**
- **Infrastructure**: Only changed stacks deploy
- **Services**: Hot-swap deployment for Lambda (2-10x faster)
- **Auto-detection**: No manual decisions needed

### 🛡️ **Safety**
- **Synth first**: Catches errors before deployment
- **Production confirmations**: Prevents accidental prod deploys
- **Dependency order**: Proper stack deployment sequence

### 🧠 **Intelligence** 
- **Git-aware**: Detects changes since last commit
- **Shared package handling**: Rebuilds dependents automatically
- **Conflict prevention**: Warns if infrastructure needs to deploy first
- **Verbose dev logging**: Dev environment shows detailed output for better error debugging

## Error Prevention

The new scripts include the `synth` step before deployment, so you won't encounter the "No stack named" error anymore. Each deployment:

1. ✅ Synthesizes stacks (validates configuration)
2. ✅ Checks dependencies
3. ✅ Deploys in correct order
4. ✅ Uses hot-swap for dev environments (faster)

## Command Reference

| Command | Purpose | Environment |
|---------|---------|-------------|
| `pnpm deploy:infra` | Smart infrastructure deployment | dev |
| `pnpm deploy:services` | Smart service deployment | dev |
| `pnpm deploy:db` | Database stack only | dev |
| `pnpm deploy:auth` | Cognito stack only | dev |
| `pnpm deploy:service:auth` | Auth service only | dev |
| `pnpm diff` | Show infrastructure changes | dev |
| `pnpm synth` | Validate stacks | dev |

Add `:prod` suffix for production deployment (e.g., `pnpm deploy:infra:prod`).

## Troubleshooting

### Stack Not Found Error
```bash
# This is now fixed - scripts always synth first
pnpm synth  # Manual check if needed
```

### Service Won't Update
```bash
# Force specific service deployment
pnpm deploy:service:auth dev
```

### Infrastructure Dependencies
```bash
# Deploy in order manually if auto-detection fails
pnpm deploy:db
pnpm deploy:auth  
pnpm deploy:lambda
pnpm deploy:api
```

---

**Next**: Continue with Phase 7.2 (API Gateway JWT Integration)