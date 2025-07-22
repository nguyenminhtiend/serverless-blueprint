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

```bash
# Deploy to development environment
./scripts/deploy.sh dev

# Deploy to production environment
./scripts/deploy.sh prod
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
├── scripts/                  # Build and deployment scripts
│   ├── build.sh             # Build all packages
│   ├── deploy.sh            # Deploy infrastructure
│   └── test.sh              # Run all tests
└── README.md                # This file
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm deploy` | Deploy infrastructure |
| `pnpm clean` | Clean all build artifacts |

## 🏗️ Architecture Overview

- **Infrastructure**: AWS CDK with TypeScript
- **Runtime**: Node.js 22.x on Lambda (ARM64)
- **Framework**: Middy middleware engine
- **Database**: DynamoDB with single-table design
- **Events**: EventBridge + SQS for async communication
- **API**: API Gateway HTTP API v2
- **Monitoring**: CloudWatch + X-Ray

## 📋 Implementation Phases

This project follows a phased implementation approach:

- ✅ **Phase 1**: Project Foundation (Current)
- 🔄 **Phase 2**: Shared Libraries Setup
- ⏳ **Phase 3**: AWS CDK Infrastructure Foundation
- ⏳ **Phase 4**: Core Infrastructure Stacks
- ⏳ **Phase 5**: Event-Driven Architecture
- ✅ **Phase 6**: Middleware & Common Services (Enhanced with Pino + Zod)
- ⏳ **Phase 7**: First Microservice (Auth)
- ⏳ **Phase 8**: Core Microservices
- ⏳ **Phase 9**: Event-Driven Services
- ⏳ **Phase 10**: Monitoring & Observability
- ⏳ **Phase 11**: Security Hardening
- ⏳ **Phase 12**: Testing & Quality Assurance
- ⏳ **Phase 13**: CI/CD Pipeline
- ⏳ **Phase 14**: Documentation & Finalization

## 🔍 Verification

After completing Phase 1, verify the setup:

```bash
# Check project structure
ls -la packages/
ls -la infrastructure/
ls -la scripts/

# Verify dependencies
pnpm install

# Check TypeScript configuration
npx tsc --noEmit

# Run linting
pnpm lint

# Test build scripts
chmod +x scripts/*.sh
./scripts/test.sh
```

## 📚 Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed phase-by-phase guide
- [Architecture Guide](./docs/architecture.md) - System design and patterns
- [API Documentation](./docs/api.md) - Endpoint specifications
- [Deployment Guide](./docs/deployment.md) - Environment setup and CI/CD

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Run tests before submitting changes
3. Update documentation for new features
4. Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Next Steps**: Proceed to Phase 2 by setting up shared libraries. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed instructions.