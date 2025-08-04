# Comprehensive Unit Testing Setup Plan for Serverless Microservices Blueprint

## 🎯 Executive Summary

This plan establishes a production-ready testing framework for your AWS serverless microservices architecture using **Vitest** (2025's fastest test runner) with a **100% code coverage strategy** that prioritizes efficiency and speed.

---

## 🏗️ Codebase Architecture Analysis

### **Service Architecture Overview**
- **4 Microservices**: Auth, Orders, Users, Notifications
- **2 Shared Libraries**: Core utilities, Middleware framework  
- **Tech Stack**: TypeScript, AWS Lambda, DynamoDB, Cognito, EventBridge, SQS
- **Framework**: Custom middleware router with Zod validation

### **Code Patterns & Complexity Analysis**

#### **Service-Auth** (`/packages/service-auth/src/`)
- **Complexity**: Medium-High
- **AWS Services**: Cognito Identity Provider
- **Functions**: 3 handlers (login, register, confirm-signup)
- **Key Components**: JWT/Cognito token handling, Secret hash calculations, Error handling

#### **Service-Orders** (`/packages/service-orders/src/`)
- **Complexity**: High
- **AWS Services**: DynamoDB, EventBridge
- **Functions**: 2 handlers + event publishing
- **Key Components**: DynamoDB single-table design, EventBridge publishing, Business logic

#### **Service-Users** (`/packages/service-users/src/`)
- **Complexity**: Medium
- **AWS Services**: Cognito, DynamoDB
- **Functions**: 1 handler (profile retrieval)
- **Key Components**: Multi-source data aggregation, Profile schema validation

#### **Service-Notifications** (`/packages/service-notifications/src/`)
- **Complexity**: High
- **AWS Services**: SES, SNS, SQS
- **Functions**: Event-driven processing
- **Key Components**: Multi-channel notifications, EventBridge routing, Batch processing

#### **Shared-Core** (`/packages/shared-core/src/`)
- **Complexity**: Low
- **Components**: Logger factory, common types, HTTP helpers

#### **Shared-Middleware** (`/packages/shared-middleware/src/`)
- **Complexity**: Medium-High
- **Key Components**: Custom router, JWT extraction, Schema validation, Error handling

---

## 🎯 Optimal Testing Strategy for 100% Coverage

### **Strategic Approach: "Test Pyramid with Smart Mocking"**

#### **1. Foundation Layer (80% of coverage, 20% of effort)**
- **Target**: Pure business logic, utilities, schemas
- **Speed**: Ultra-fast (no I/O operations)
- **Coverage**: 95%+ achievable with simple unit tests

#### **2. Service Layer (15% of coverage, 60% of effort)**  
- **Target**: AWS service integrations with mocking
- **Speed**: Fast (mocked external calls)
- **Coverage**: 90%+ with AWS SDK mocks

#### **3. Integration Layer (5% of coverage, 20% of effort)**
- **Target**: Critical end-to-end flows
- **Speed**: Moderate (LocalStack containers)
- **Coverage**: 80%+ for essential scenarios

### **Priority Testing Order (High ROI → Low ROI)**

#### **Week 1: Foundation Testing (Easy Wins)**
1. **shared-core/** - Logger, types, utilities (100% coverage)
2. **shared-middleware/** - Router, JWT utils, responses (95% coverage)
3. **Service schemas** - Zod validators across all services (100% coverage)
4. **Pure business logic** - Order calculations, validation functions (100% coverage)

#### **Week 2: Service Handler Testing (Moderate Effort)**
1. **service-auth/** - Mock Cognito SDK, test login/register flows
2. **service-users/** - Mock DynamoDB, test profile retrieval
3. **service-orders/** - Mock DynamoDB + EventBridge, test order creation
4. **service-notifications/** - Mock SES/SNS, test notification sending

#### **Week 3: Integration Testing (High Impact)**
1. **Critical user flows** - Auth → Profile → Order creation
2. **Event processing** - Order events → Notifications
3. **Error scenarios** - Network failures, invalid tokens

### **Fast Execution Techniques**

#### **1. Smart Mocking Strategy**
```typescript
// Mock entire AWS SDK modules, not individual calls
vi.mock('@aws-sdk/client-cognito-identity-provider')
vi.mock('@aws-sdk/client-dynamodb')
vi.mock('@aws-sdk/client-eventbridge')
```

#### **2. Test Organization**
```
tests/
├── unit/           # Fast tests (0-50ms each)
├── integration/    # Moderate tests (100-500ms each)  
└── e2e/           # Slow tests (1-5s each)
```

#### **3. Parallel Execution**
- Vitest runs tests in parallel by default
- Separate test suites prevent resource conflicts
- Mock reset between tests for isolation

### **Code Coverage Targets**

| Package | Target Coverage | Strategy |
|---------|----------------|----------|
| shared-core | 100% | Pure functions, easy to test |
| shared-middleware | 95% | Mock HTTP contexts |
| service-auth | 90% | Mock Cognito SDK |
| service-orders | 90% | Mock DynamoDB + EventBridge |
| service-users | 95% | Simple profile logic |
| service-notifications | 85% | Complex multi-service flows |

---

## 📋 Phase 1: Basic Unit Testing Infrastructure Setup

### 1.1 Modern Testing Framework Selection (2025 Best Practices)

**Primary Framework: Vitest** 
- ✅ **5x faster** than Jest with native ESM support
- ✅ **Built-in TypeScript** support without configuration
- ✅ **Native ES Modules** compatibility (your project uses `"type": "module"`)
- ✅ **Advanced watch mode** with intelligent test re-running
- ✅ **Zero configuration** for most TypeScript projects

### 1.2 Basic Unit Testing Dependencies Installation

```bash
# Fetch latest versions first
pnpm update

# Core unit testing dependencies only
pnpm add -D -w vitest@latest @vitest/ui@latest @vitest/coverage-v8@latest
pnpm add -D -w @types/node@latest happy-dom@latest
```

### 1.3 Tests Folder Structure

**Root-level `tests/` folder organization:**

```
tests/
├── setup.ts                    # Basic test setup (Phase 1)
├── example.test.ts             # Basic example tests (Phase 1)
├── coverage/                   # Coverage reports output
│
├── unit/                       # Unit tests (Phase 1-2)
│   ├── shared/                 # Shared utilities tests
│   │   ├── shared-core/        # shared-core package tests
│   │   └── shared-middleware/  # shared-middleware package tests
│   └── services/               # Service-specific tests
│       ├── service-auth/       # Auth service tests
│       ├── service-orders/     # Orders service tests
│       ├── service-users/      # Users service tests
│       └── service-notifications/ # Notifications service tests
│
├── integration/                # Integration tests (Phase 5+)
│   ├── api/                    # API integration tests
│   ├── database/               # Database integration tests
│   └── aws/                    # AWS service integration tests
│
├── performance/                # Performance tests (Phase 7+)
│   ├── lambda/                 # Lambda performance tests
│   └── database/               # Database performance tests
│
├── factories/                  # Test data factories (Phase 3+)
│   ├── user/                   # User-related factories
│   ├── order/                  # Order-related factories
│   ├── product/                # Product-related factories
│   └── basic.factory.ts        # Basic factories
│
├── mocks/                      # Mock implementations (Phase 4+)
│   ├── aws/                    # AWS service mocks
│   │   ├── cognito.mock.ts     # Cognito mock factory
│   │   ├── dynamodb.mock.ts    # DynamoDB mock factory
│   │   ├── eventbridge.mock.ts # EventBridge mock factory
│   │   └── ses-sns.mock.ts     # SES/SNS mock factory
│   ├── api/                    # API mocks
│   ├── database/               # Database mocks
│   └── setup-msw.ts            # MSW server setup
│
└── helpers/                    # Test helper utilities
    ├── lambda-context.ts       # Lambda context helpers (Phase 3+)
    ├── api-gateway-event.ts    # API Gateway event helpers (Phase 3+)
    └── test-utils.ts           # General test utilities
```

### 1.4 Root Level Test Configuration

**File: `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.ts', './packages/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './tests/coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'infrastructure/',
        'scripts/',
        'tests/'
      ],
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Package-specific thresholds for 100% coverage
        'packages/shared-core/src/**': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'packages/shared-middleware/src/**': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'packages/service-*/src/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './packages/shared-core/src'),
      '@types': resolve(__dirname, './packages/shared-types/src'),
      '@database': resolve(__dirname, './packages/shared-database/src'),
      '@middleware': resolve(__dirname, './packages/shared-middleware/src')
    }
  }
})
```

**File: `tests/setup.ts`**
```typescript
import { beforeEach, afterEach, vi } from 'vitest'

// Basic test environment setup for unit tests only
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Clean up after each test
  vi.resetModules()
})

// Global mock setup for AWS SDK
vi.mock('@aws-sdk/client-cognito-identity-provider')
vi.mock('@aws-sdk/client-dynamodb')
vi.mock('@aws-sdk/lib-dynamodb')
vi.mock('@aws-sdk/client-eventbridge')
vi.mock('@aws-sdk/client-ses')
vi.mock('@aws-sdk/client-sns')
```

---

## 📋 Phase 2: Basic Unit Testing Configuration

### 2.1 Basic Package Scripts

**Update root `package.json`:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:unit:watch": "vitest --config vitest.config.ts",
    "test:coverage:100": "vitest run --coverage --coverage.thresholds.global.branches=100 --coverage.thresholds.global.functions=100 --coverage.thresholds.global.lines=100 --coverage.thresholds.global.statements=100",
    "typecheck": "tsc --noEmit"
  }
}
```

### 2.2 Simple Test Examples

**File: `tests/example.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'

describe('Basic Unit Test Example', () => {
  it('should demonstrate basic testing', () => {
    const result = 2 + 2
    expect(result).toBe(4)
  })

  it('should test string operations', () => {
    const greeting = 'Hello World'
    expect(greeting).toContain('World')
    expect(greeting.length).toBe(11)
  })
})
```

---

## 📋 Phase 3: Advanced Testing Dependencies & Utilities

### 3.1 AWS and External Service Testing Dependencies (Phase 3+)

```bash
# Fetch latest versions first
pnpm update

# AWS testing utilities (moved to Phase 3)
pnpm add -D -w @types/aws-lambda@latest
pnpm add -D -w @faker-js/faker@latest
pnpm add -D -w factory.ts@latest

# Mock service workers for API mocking (Phase 4+)
pnpm add -D -w msw@latest whatwg-fetch@latest

# AWS SDK testing utilities (Phase 5+)
pnpm add -D -w @aws-sdk/client-dynamodb@latest @aws-sdk/lib-dynamodb@latest
```

**File: `tests/mocks/aws/cognito.mock.ts`**
```typescript
import { vi } from 'vitest'

export const mockCognitoClient = {
  send: vi.fn(),
}

export const createMockCognitoResponse = (overrides = {}) => ({
  AuthenticationResult: {
    AccessToken: 'mock-access-token',
    IdToken: 'mock-id-token',
    RefreshToken: 'mock-refresh-token',
    ...overrides
  }
})
```

**File: `tests/factories/basic.factory.ts`**
```typescript
import { faker } from '@faker-js/faker'

export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  ...overrides
})

export const createMockOrder = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  total: faker.number.float({ min: 10, max: 1000 }),
  status: 'pending',
  createdAt: faker.date.recent().toISOString(),
  ...overrides
})
```

---

## 📋 Phase 4: Mock Service Workers & API Testing

**File: `tests/setup-msw.ts`**
```typescript
import { setupServer } from 'msw/node'
import { beforeAll, afterAll, beforeEach } from 'vitest'

// Mock API server setup for Phase 4
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterAll(() => server.close())
beforeEach(() => server.resetHandlers())

export { server }
```

---

## 📋 Phase 5: LocalStack & Container Testing Dependencies

### 5.1 LocalStack & Container Testing Dependencies

```bash
# Fetch latest versions first
pnpm update

# Container testing utilities (Phase 5+)
pnpm add -D -w @testcontainers/localstack@latest
pnpm add -D -w testcontainers@latest

# AWS Lambda testing (Phase 5+)
pnpm add -D -w aws-lambda-test-utils@latest
```

### 5.2 Integration Test Setup

**File: `tests/integration/setup.ts`**
```typescript
import { beforeAll, afterAll } from 'vitest'
// LocalStack container setup for integration tests (Phase 5)
// Moved complex AWS integration to Phase 5+
```

---

## 📋 Phase 6: Infrastructure Testing (CDK/SAM)

### 6.1 CDK Testing Dependencies (Phase 6+)

```bash
# CDK testing utilities (Phase 6+)
pnpm add -D -w aws-cdk-lib@latest
pnpm add -D -w @aws-cdk/assertions@latest
```

---

## 📋 Phase 7: Performance & Load Testing

### 7.1 Performance Testing Dependencies (Phase 7+)

```bash
# Performance testing utilities (Phase 7+)
pnpm add -D -w autocannon@latest
pnpm add -D -w clinic@latest
```

---

## 📋 Phase 8: GitHub Actions Setup

### 8.1 GitHub Actions Setup (Phase 8+)

**File: `.github/workflows/test.yml`**
```yaml
name: Unit Tests with 100% Coverage
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22.x
        cache: 'pnpm'
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:coverage:100
    - name: Upload coverage reports
      uses: codecov/codecov-action@v4
      with:
        file: ./tests/coverage/lcov.info
```

---

## 🎯 Implementation Timeline & Success Metrics

### Phase Implementation Order (Optimized for 100% Coverage)
1. **Phase 1-2** (Week 1): Basic Vitest setup with 100% coverage configuration
2. **Phase 3** (Week 2): AWS mocks and factories for comprehensive testing  
3. **Phase 4** (Week 3): Service handler testing with complete coverage
4. **Phase 5** (Week 4): Integration testing for critical flows
5. **Phase 6** (Week 5): Infrastructure (CDK) testing
6. **Phase 7** (Week 6): Performance testing
7. **Phase 8** (Week 7): Full CI/CD integration with coverage reporting

### Testing Coverage by Location & Phase

#### **packages/** Testing (Service Unit Tests):
- **Phase 1-2**: Basic unit testing setup with 100% coverage targets
- **Phase 3**: AWS service mocking and comprehensive test utilities
- **Phase 4**: Complete service handler coverage with edge cases

#### **infrastructure/** Testing (CDK/Infrastructure Tests):
- **Phase 6**: CDK/SAM infrastructure testing with aws-cdk-lib and @aws-cdk/assertions

### Test Types by Phase:

#### **Unit Tests (100% Coverage Focus)**:
- **Phase 1-2**: Comprehensive unit tests in `tests/unit/` folder
  - `tests/unit/shared/shared-core/` - 100% coverage for utilities
  - `tests/unit/shared/shared-middleware/` - 95% coverage for middleware
  - `tests/unit/services/service-*/` - 90% coverage for service logic

#### **Integration Tests**:
- **Phase 5**: Critical integration tests in `tests/integration/` folder
  - `tests/integration/api/` - API integration tests
  - `tests/integration/database/` - Database integration tests
  - `tests/integration/aws/` - AWS service integration tests

#### **E2E/Performance Tests**:
- **Phase 7**: Performance tests (E2E-style) in `tests/performance/` folder
  - `tests/performance/lambda/` - Lambda performance tests
  - `tests/performance/database/` - Database performance tests

### Success Metrics for 100% Coverage Strategy
- ✅ **Unit Test Coverage** 
  - shared-core: 100%
  - shared-middleware: 95%
  - service packages: 90%+
  - Overall: 95%+
- ✅ **Test Execution Speed**: <30 seconds for full suite
- ✅ **Test Code Ratio**: ~40% of production code size
- ✅ **Smart Mocking**: AWS services mocked, no actual API calls
- ✅ **Progressive Enhancement**: Build complexity incrementally

### Expected Results
- **Total Coverage**: 95%+ across all packages
- **Test Execution Time**: <30 seconds for full suite
- **Test Code Volume**: ~40% of production code size
- **Maintenance Effort**: Low (focused on business logic)

### Key Strategy Changes for 100% Coverage
- **100% Coverage Targets** - Set aggressive but achievable coverage thresholds
- **Smart AWS Mocking** - Complete AWS SDK mocking for fast, reliable tests
- **Package-specific Coverage** - Different thresholds based on complexity
- **Foundation-first Approach** - Start with high-ROI, easy-to-test code
- **Comprehensive Test Structure** - Organized for maintainability and speed

This optimized approach ensures you achieve 100% code coverage efficiently while maintaining fast execution and high code quality.