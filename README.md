# AWS Serverless Microservices Blueprint

A production-ready serverless microservices architecture using AWS CDK, TypeScript, and modern development practices.

## 🚀 Quick Start

### Prerequisites

- **Node.js 22.x LTS** - [Download](https://nodejs.org/)
- **pnpm v9.0+** - `npm install -g pnpm`
- **AWS CLI** - [Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **AWS CDK v2** - `npm install -g aws-cdk`

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd serverless-blueprint

# Install dependencies
pnpm install

# Bootstrap AWS CDK (first time only)
cd infrastructure
pnpm cdk bootstrap
cd ..
```

### Development Setup

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

### Deployment

The deployment system has been simplified with smart scripts that automatically detect changes:

```bash
# Deploy infrastructure (auto-detects changes)
pnpm deploy:infra          # Deploy to dev
pnpm deploy:infra:prod     # Deploy to prod

# Deploy services (fast hot-swap deployment)
pnpm deploy:services       # Deploy to dev  
pnpm deploy:services:prod  # Deploy to prod

# Specific deployments
pnpm deploy:db             # Database stack only
pnpm deploy:auth           # Cognito authentication stack
pnpm deploy:lambda         # Lambda stack only
pnpm deploy:service:auth   # Auth service only

# No-hotswap deployments (for infrastructure property changes)
pnpm deploy:lambda:no-hotswap      # Lambda stack without hotswap (dev)
pnpm deploy:lambda:no-hotswap:prod # Lambda stack without hotswap (prod)

# Utilities
pnpm diff                  # Show infrastructure changes
pnpm synth                 # Validate stacks
```

## 📁 Project Structure

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed project structure and architecture.

## 🔧 Available Scripts

### Development Commands
| Script | Description |
|--------|-------------|
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Clean all build artifacts |

### Deployment Commands
| Script | Description | Environment |
|--------|-------------|-------------|
| `pnpm deploy:infra` | Smart infrastructure deployment | dev |
| `pnpm deploy:services` | Smart service deployment | dev |
| `pnpm deploy:db` | Database stack only | dev |
| `pnpm deploy:auth` | Cognito stack only | dev |
| `pnpm deploy:lambda` | Lambda stack only | dev |
| `pnpm deploy:lambda:no-hotswap` | Lambda stack without hotswap | dev |
| `pnpm deploy:service:auth` | Auth service only | dev |
| `pnpm diff` | Show infrastructure changes | dev |
| `pnpm synth` | Validate stacks | dev |

Add `:prod` suffix for production (e.g., `pnpm deploy:infra:prod`).

### Smart Deployment Features
- ✅ **Auto-detection**: Automatically detects which stacks/services changed
- ✅ **Error prevention**: Always runs `synth` first to catch errors
- ✅ **Fast service updates**: Uses hot-swap deployment for 2-10x faster Lambda deployments
- ✅ **Verbose dev logging**: Dev environment shows detailed output for better error debugging
- ✅ **Production safety**: Asks for confirmation on prod deployments
- ✅ **No-hotswap options**: Available for infrastructure property changes that require CloudFormation

### When to Use No-Hotswap Deployment

Use `pnpm deploy:lambda:no-hotswap` when:
- Changing Lambda configuration properties (memory, timeout, environment variables)
- Enabling/disabling X-Ray tracing (`TracingConfig`)
- Modifying IAM permissions or security groups
- Adding/removing event sources or triggers

Regular `pnpm deploy:lambda` uses hotswap for faster code-only updates.

### Deployment Flow
```bash
# First time setup
pnpm bootstrap                # Bootstrap CDK (one time)
pnpm deploy:infra            # Deploy all infrastructure

# Daily development
pnpm deploy:services         # Fast service updates
pnpm deploy:infra           # Only if infrastructure changed

# Production deployment
pnpm diff                   # Show what will change
pnpm deploy:infra:prod      # Infrastructure first
pnpm deploy:services:prod   # Services second
```

## 🏗️ Architecture Overview

Modern serverless microservices using AWS CDK, Node.js 22.x, DynamoDB, and EventBridge.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for complete architecture details and technology stack.

## 📋 Implementation Status

**Current Phase**: 7.1 (Cognito Stack) ✅  
**Next Phase**: 7.2 (API Gateway JWT Integration)

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for complete phase details and technical specifications.

## 🔍 Verification

Verify the current setup (Phase 7.1 completed):

```bash
# Check project structure
ls -la packages/           # Should show 8 packages
ls -la infrastructure/lib/ # Should show 5 stacks including cognito-stack.ts
ls -la scripts/           # Should show 2 deployment scripts

# Verify dependencies and build
pnpm install
pnpm build

# Check infrastructure
pnpm synth                # Should synthesize 5 stacks
pnpm diff                 # Show any infrastructure changes

# Test deployment scripts
pnpm deploy:infra --help
pnpm deploy:services --help
```

### Current Infrastructure Status
- ✅ Database Stack (DynamoDB)
- ✅ Cognito Stack (User Pools) 
- ✅ Events Stack (EventBridge + SQS)
- ✅ Lambda Stack (Functions)
- ✅ API Gateway Stack (HTTP API)

## 📚 Documentation

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Complete technical guide, architecture details, and phase-by-phase implementation

---

**Current Status**: Phase 7.1 completed - Cognito authentication infrastructure deployed.  
**Next Steps**: Continue with Phase 7.2 (API Gateway JWT Integration). See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed instructions.