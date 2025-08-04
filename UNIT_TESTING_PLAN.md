# Comprehensive Unit Testing Setup Plan for Serverless Microservices Blueprint

## 🎯 Executive Summary

This plan establishes a production-ready testing framework for your AWS serverless microservices architecture using **Vitest** (2025's fastest test runner) with a phased approach that prioritizes basic unit testing setup first.

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
│   ├── services/               # Service-specific tests
│   ├── middleware/             # Middleware tests
│   └── database/               # Database layer tests
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
│   ├── api/                    # API mocks
│   ├── database/               # Database mocks
│   └── setup-msw.ts            # MSW server setup
│
└── helpers/                    # Test helper utilities
    ├── lambda-context.ts       # Lambda context helpers (Phase 3+)
    ├── api-gateway-event.ts    # API Gateway event helpers (Phase 3+)
    └── test-utils.ts           # General test utilities
```

**Key Benefits of this Structure:**

1. **Phase-aligned Organization** - Each folder corresponds to implementation phases
2. **Clear Separation of Concerns** - Unit, integration, and performance tests are isolated
3. **Reusable Components** - Factories, mocks, and helpers can be shared across test types
4. **Scalable Architecture** - Easy to add new test categories and services
5. **IDE-Friendly** - Clear navigation and file discovery

**Folder Usage by Phase:**

- **Phase 1-2**: `tests/setup.ts`, `tests/example.test.ts`, `tests/unit/`
- **Phase 3**: `tests/factories/`, `tests/helpers/`  
- **Phase 4**: `tests/mocks/setup-msw.ts`, `tests/mocks/api/`
- **Phase 5**: `tests/integration/`, `tests/mocks/aws/`
- **Phase 7**: `tests/performance/`

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
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
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

**File: `tests/factories/basic.factory.ts`**
```typescript
// Simple factory example for Phase 3
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
})

export const createMockRequest = (overrides: Partial<any> = {}) => ({
  method: 'GET',
  url: '/api/test',
  headers: {},
  body: null,
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

### 8.1 GitHub Actions Setup (Phase 8+)

**File: `.github/workflows/test.yml`**
```yaml
name: Unit Tests
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
    - run: pnpm test:unit
```

---

## 🎯 Implementation Timeline & Success Metrics

### Phase Implementation Order (Simplified)
1. **Phase 1-2** (Week 1): Basic Vitest setup with simple unit tests
2. **Phase 3** (Week 2): Basic factories and mock utilities  
3. **Phase 4** (Week 3): MSW and API mocking
4. **Phase 5** (Week 4): AWS service integration with LocalStack
5. **Phase 6** (Week 5): Infrastructure (CDK) testing
6. **Phase 7** (Week 6): Performance testing
7. **Phase 8** (Week 7): Full CI/CD integration

### Success Metrics
- ✅ **Unit Test Coverage**: 85%+ across all packages
- ✅ **Simple Setup**: Start with basic unit tests first  
- ✅ **Progressive Enhancement**: Add complexity incrementally
- ✅ **Latest Dependencies**: Always fetch latest versions before install

### Key Changes Made
- **Removed Jest dependencies** - Focus purely on Vitest
- **Simplified Phase 1-2** - Basic unit testing setup only
- **Root-level `tests/` folder** - Centralized test organization
- **Latest version fetching** - `pnpm update` before each install phase
- **Progressive complexity** - Advanced features moved to later phases

This simplified approach ensures you can start with basic unit testing immediately while building towards more complex integration testing in later phases.