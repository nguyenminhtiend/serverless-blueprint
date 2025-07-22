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
pnpm deploy:service:auth   # Auth service only

# Utilities
pnpm diff                  # Show infrastructure changes
pnpm synth                 # Validate stacks
```

## 📁 Project Structure

```
serverless-blueprint/
├── packages/                    # Shared libraries and services
│   ├── shared-core/            # Business logic utilities
│   ├── shared-types/           # TypeScript interfaces
│   ├── shared-database/        # DynamoDB models & clients
│   ├── shared-middleware/      # Common Middy middleware
│   ├── service-auth/           # Authentication microservice
│   ├── service-users/          # User management microservice
│   ├── service-orders/         # Orders microservice
│   └── service-notifications/  # Event-driven notifications
├── infrastructure/             # AWS CDK infrastructure
│   ├── lib/                   # CDK stack definitions
│   └── bin/                   # CDK app entry point
├── layers/                    # Lambda layers
│   ├── aws-sdk/              # AWS SDK layer
│   └── monitoring/           # Observability tools layer
├── scripts/                  # Smart deployment scripts
│   ├── deploy-infra.sh      # Infrastructure deployment
│   └── deploy-services.sh   # Service deployment
└── README.md                # This file
```

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

- **Infrastructure**: AWS CDK v2 with TypeScript
- **Runtime**: Node.js 22.x on Lambda (ARM64)
- **Framework**: Middy + Pino Logger + Zod Validation
- **Database**: DynamoDB with single-table design
- **Events**: EventBridge + SQS for async communication
- **API**: API Gateway HTTP API v2 with JWT authorization
- **Authentication**: AWS Cognito User Pools
- **Monitoring**: CloudWatch + X-Ray + Pino structured logging

## 📋 Implementation Phases

This project follows a phased implementation approach:

- ✅ **Phase 1**: Project Foundation
- ✅ **Phase 2**: Shared Libraries Setup
- ✅ **Phase 3**: AWS CDK Infrastructure Foundation
- ✅ **Phase 4**: Core Infrastructure Stacks
- ✅ **Phase 5**: Event-Driven Architecture
- ✅ **Phase 6**: Middleware & Common Services (Pino + Zod)
- 🔄 **Phase 7**: Simple Cognito Authentication Setup (Current)
  - ✅ Phase 7.1: Basic Cognito Stack
  - ⏳ Phase 7.2: API Gateway JWT Integration
  - ⏳ Phase 7.3: Update Auth Service
- ⏳ **Phase 8**: Core Microservices
- ⏳ **Phase 9**: Event-Driven Services
- ⏳ **Phase 10**: Monitoring & Observability
- ⏳ **Phase 11**: Testing & Quality Assurance
- ⏳ **Phase 12**: CI/CD Pipeline

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

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed phase-by-phase guide

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Run tests before submitting changes
3. Update documentation for new features
4. Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Current Status**: Phase 7.1 completed - Cognito authentication infrastructure deployed.  
**Next Steps**: Continue with Phase 7.2 (API Gateway JWT Integration). See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed instructions.