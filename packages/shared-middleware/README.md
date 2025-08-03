# Shared Middleware

Common middleware functions for Lambda handlers in the serverless blueprint.

## Body Parsing

### Centralized Approach

All Lambda handlers should use the centralized body parsing middleware instead of manual `JSON.parse()` calls:

```typescript
import { parseValidatedBody } from '@shared/middleware';
import { MyRequestSchema, MyRequest } from '../schemas';

export const myHandler = async (event: APIGatewayProxyEvent) => {
  // ✅ Use centralized body parsing + validation
  const requestData = parseValidatedBody<MyRequest>(event, MyRequestSchema);

  // ❌ Don't do manual parsing
  // const requestData = JSON.parse(event.body);
};
```

### Why This Approach?

1. **Consistency**: All handlers use the same parsing logic
2. **Error Handling**: Standardized error messages for malformed JSON
3. **Middleware Integration**: Works seamlessly with `httpJsonBodyParser` middleware
4. **Type Safety**: Validates and types the parsed body in one step
5. **Performance**: Avoids duplicate parsing

## JWT Authorizer Support (API Gateway v2)

### TypeScript Types for JWT Claims

This middleware provides proper TypeScript support for AWS API Gateway HTTP API v2.0 with JWT authorizers:

```typescript
import { 
  APIGatewayProxyEventV2WithJWTAuthorizer,
  JWTClaims,
  getJWTClaims,
  getUserId,
  requireUserId,
  createRouter 
} from '@shared/middleware';

// Create a handler with proper JWT types
export const handler = createRouter([
  {
    method: 'GET',
    path: '/profile',
    handler: async (ctx) => {
      // ✅ Type-safe access to JWT claims
      const claims = getJWTClaims(ctx.event);
      const userId = getUserId(ctx.event);
      const requiredUserId = requireUserId(ctx.event); // Throws on missing

      return {
        statusCode: 200,
        body: JSON.stringify({ userId, claims }),
      };
    },
  },
]);
```

### JWT Claims Access Methods

```typescript
// Safe access (returns null if not found)
const claims = getJWTClaims(event); // JWTClaims | null
const userId = getUserId(event);    // string | undefined
const email = getUserEmail(event);  // string | undefined

// Specific claim access
const customClaim = getJWTClaim(event, 'custom:role'); // string | number | boolean | undefined

// Required access (throws HttpError if not found)
const claims = requireJWTClaims(event); // JWTClaims (never null)
const userId = requireUserId(event);    // string (never undefined)
```

### Claims Property Path

JWT claims are accessible at:
```typescript
event.requestContext.authorizer?.jwt?.claims
```

### Custom Type Definition

The middleware extends the standard `APIGatewayProxyEventV2` to include JWT authorizer support:

```typescript
interface APIGatewayProxyEventV2WithJWTAuthorizer extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims: Record<string, string | number | boolean>;
        scopes?: string[] | null;
      };
      lambda?: Record<string, any>;  // Lambda authorizer support
      iam?: { /* IAM context */ };   // IAM authorizer support
    };
  };
}
```

### Error Handling

```typescript
import { HttpError } from '@shared/middleware';

try {
  const userId = requireUserId(event);
  // Process with guaranteed userId
} catch (error) {
  if (error instanceof HttpError && error.statusCode === 401) {
    // Handle missing JWT claims
    return error.toResponse();
  }
  throw error;
}
```

### Why This Approach?

1. **Type Safety**: Full TypeScript support for JWT claims
2. **Error Handling**: Standardized 401 responses for missing claims
3. **Convenience**: Helper functions for common claim access patterns
4. **Future-Proof**: Supports Lambda and IAM authorizers too
5. **Standards Compliant**: Follows AWS API Gateway v2 event structure

## User Authentication

### Legacy Support

For backward compatibility, the old auth utilities are still available:

```typescript
import { extractUserOrError, UserContext } from '@shared/middleware';

export const myHandler = async (event: APIGatewayProxyEvent) => {
  // ✅ Legacy approach (still supported)
  const userResult = extractUserOrError(event);
  if ('statusCode' in userResult) {
    return userResult;
  }
  const { userId, email } = userResult as UserContext;
};
```

### Default Middleware Configuration

The `createRouter` function enables JSON body parsing by default:

```typescript
const { router, handler } = createRouter(
  { serviceName: 'my-service' },
  {
    jsonBodyParser: true,  // ✅ Default: enabled
    multipartBodyParser: false,  // Default: disabled
  }
);
```

### Best Practices

1. **Always enable `jsonBodyParser`** for REST APIs (default behavior)
2. **Use `parseValidatedBody`** instead of manual JSON.parse
3. **Use `extractUserOrError`** instead of manual auth parsing
4. **Trust the middleware** - body is already parsed when it reaches your handler
5. **Handle validation errors** at the middleware level when possible

## Error Handling

The centralized approach provides better error messages:

- **Middleware not configured**: Clear error when body is still a string
- **Validation errors**: Zod validation errors with precise field information
- **Malformed JSON**: Handled by the middleware before reaching your handler
- **Auth errors**: Standardized 401/400 responses with clear messages

## 🚀 Features

- **🔐 Authentication & Authorization**: JWT validation, role-based access control
- **📝 Structured Logging**: High-performance Pino logger with AWS Lambda optimizations
- **✅ Type-Safe Validation**: Zod-based schema validation with TypeScript inference
- **🌐 CORS Management**: Environment-aware CORS configuration
- **⚡ Performance Monitoring**: Request timing, memory usage tracking
- **🔗 Correlation IDs**: Request tracing across services
- **❌ Error Handling**: Comprehensive error classification and sanitization

## 📦 Installation

```bash
pnpm add @shared/middleware
```

## 🛠️ Quick Start

### Basic API Handler

```typescript
import { createPublicApiHandler, schemas } from '@shared/middleware';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const handler = createPublicApiHandler(
  async (event) => {
    const user = userSchema.parse(JSON.parse(event.body));

    return {
      statusCode: 200,
      body: JSON.stringify({ id: '123', ...user }),
    };
  },
  {
    validation: { bodySchema: userSchema },
    logging: { logLevel: 'info' }
  }
);
```

### Protected API Handler

```typescript
import { createProtectedApiHandler, requireRole } from '@shared/middleware';

export const handler = createProtectedApiHandler(
  async (event) => {
    const userId = event.user.id; // Type-safe user context

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Hello ${userId}` }),
    };
  },
  { secret: process.env.JWT_SECRET }
).use(requireRole(['admin', 'user']));
```

## 🔧 Core Components

### 1. Pino Logger (v9.7.0)

**Enhanced shared-core logger with Pino:**

```typescript
import { createLogger, LogLevel } from '@shared/core';

const logger = createLogger('my-service', {
  userId: '123',
  correlationId: 'abc-def'
}, {
  level: LogLevel.INFO,
  prettyPrint: true // Development only
});

logger.info('User action', { action: 'login', success: true });
logger.error('Operation failed', { operation: 'database' }, error);
```

**Features:**
- ⚡ High-performance async logging
- 🎨 Pretty printing in development
- 🔍 Structured JSON output in production
- 🏷️ Correlation ID tracking
- 📊 AWS Lambda optimizations

### 2. Zod Validation (v4.0.5)

**Type-safe schema validation with excellent TypeScript integration:**

```typescript
import { zodValidationMiddleware, commonSchemas } from '@shared/middleware';
import { z } from 'zod';

// Use pre-built schemas
const handler = createApiHandler(myHandler, {
  validation: {
    bodySchema: commonSchemas.createUser,
    pathParametersSchema: commonSchemas.idPath,
    queryStringParametersSchema: commonSchemas.paginationQuery,
  }
});

// Custom schemas
const customSchema = z.object({
  name: z.string().min(2).max(50),
  age: z.number().int().min(0).max(120),
  email: z.string().email(),
  preferences: z.object({
    notifications: z.boolean().default(true),
    theme: z.enum(['light', 'dark']).default('light'),
  }).optional(),
});

// Type inference
type User = z.infer<typeof customSchema>;
```

**Pre-built Schemas:**
- ✉️ Email validation
- 🆔 UUID validation
- 📄 Pagination parameters
- 👤 User creation/update
- 📊 CRUD operations
- 📨 API responses

### 3. Authentication Middleware

```typescript
import { authMiddleware, requireRole, requirePermission } from '@shared/middleware';

// JWT Authentication
export const handler = middy(myHandler)
  .use(authMiddleware({
    secret: process.env.JWT_SECRET,
    issuer: 'my-app',
    audience: 'api',
  }))
  .use(requireRole(['admin', 'moderator']))
  .use(requirePermission(['users:read', 'users:write']));
```

### 4. Comprehensive Error Handling

```typescript
import { errorHandlerMiddleware, createValidationError } from '@shared/middleware';

// Automatic error classification
export const handler = middy(myHandler)
  .use(errorHandlerMiddleware({
    exposeStackTrace: false, // Production
    enableCors: true,
  }));

// Manual error creation
throw createValidationError('email', 'Invalid email format');
throw createNotFoundError('User', userId);
throw createRateLimitError(60); // Retry after 60 seconds
```

### 5. Environment-Aware CORS

```typescript
import { getEnvironmentCors, corsMiddleware } from '@shared/middleware';

// Automatic environment detection
export const handler = middy(myHandler)
  .use(getEnvironmentCors()); // Dev: all origins, Prod: configured origins

// Custom CORS
export const handler = middy(myHandler)
  .use(corsMiddleware({
    origin: ['https://myapp.com', 'https://admin.myapp.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));
```

## 🎯 Pre-configured Handlers

### Public API Handler
```typescript
export const handler = createPublicApiHandler(myHandler, {
  validation: { bodySchema: mySchema },
  cors: true,
  logging: { logLevel: 'info' },
});
```

### Protected API Handler
```typescript
export const handler = createProtectedApiHandler(myHandler, {
  secret: process.env.JWT_SECRET,
}, {
  cors: { origin: ['https://app.com'] },
  performance: true,
});
```

### Admin API Handler
```typescript
export const handler = createAdminApiHandler(myHandler, {
  cors: {
    origin: process.env.ADMIN_CORS_ORIGIN?.split(','),
    credentials: true,
  },
});
```

### Webhook Handler
```typescript
export const handler = createWebhookHandler(myHandler, {
  bodySchema: webhookSchema,
  headersSchema: z.object({
    'x-webhook-signature': z.string(),
  }),
}, {
  logging: { logEvent: true, logResponse: false },
});
```

## 📋 Common Usage Patterns

### Request Validation with Type Inference

```typescript
import { z } from 'zod';
import { parseAndValidate } from '@shared/middleware';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const handler = createApiHandler(async (event) => {
  // Type-safe parsing
  const userData: CreateUserInput = parseAndValidate(
    CreateUserSchema,
    JSON.parse(event.body)
  );

  // userData is fully typed with IntelliSense support
  console.log(userData.role); // 'user' | 'admin'

  return { statusCode: 201, body: JSON.stringify(userData) };
});
```

### Advanced Logging

```typescript
import { loggingMiddleware, getLogger } from '@shared/middleware';

export const handler = middy(async (event, context) => {
  const logger = getLogger({ event, context, internal: {} });

  logger.info('Processing request', {
    userId: event.user?.id,
    operation: 'user-update',
  });

  try {
    // Business logic
    const result = await updateUser(data);

    logger.info('User updated successfully', {
      userId: result.id,
      changes: Object.keys(data),
    });

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logger.error('User update failed', {
      userId: event.user?.id,
      error: error.message,
    }, error);

    throw error; // Will be handled by error middleware
  }
}).use(loggingMiddleware({
  serviceName: 'user-service',
  logLevel: LogLevel.INFO,
  redactPaths: ['password', 'token'],
}));
```

### Schema Transformations

```typescript
import { transformStringToNumber, transformEmptyStringToUndefined } from '@shared/middleware';

const QuerySchema = z.object({
  page: transformStringToNumber.pipe(z.number().min(1).default(1)),
  limit: transformStringToNumber.pipe(z.number().min(1).max(100).default(20)),
  search: transformEmptyStringToUndefined.pipe(z.string().optional()),
});

export const handler = createApiHandler(async (event) => {
  // Query parameters automatically transformed from strings
  const { page, limit, search } = QuerySchema.parse(event.queryStringParameters);

  const results = await searchUsers({ page, limit, search });
  return { statusCode: 200, body: JSON.stringify(results) };
}, {
  validation: { queryStringParametersSchema: QuerySchema }
});
```

## 🔄 Migration from JSON Schema

**Before (JSON Schema):**
```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'email'],
};
```

**After (Zod):**
```typescript
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type User = z.infer<typeof schema>; // Full TypeScript type inference
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Middleware Stack                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Event Normalization (Middy built-ins)                   │
│ 2. Correlation IDs                                          │
│ 3. Performance Monitoring                                   │
│ 4. Pino Logging                                            │
│ 5. CORS                                                     │
│ 6. Zod Validation                                          │
│ 7. JWT Authentication                                       │
│ 8. Error Handling                                          │
└─────────────────────────────────────────────────────────────┘
```

## 🧪 Testing

```typescript
import { validateEmail, validateUUID, schemas } from '@shared/middleware';

describe('Validation Utils', () => {
  test('email validation', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
  });

  test('schema parsing', () => {
    const result = schemas.pagination.parse({
      limit: '10',
      offset: '0',
    });

    expect(result.limit).toBe(10); // Transformed to number
    expect(result.order).toBe('asc'); // Default value
  });
});
```

## 🌍 Environment Variables

```bash
# Logging
LOG_LEVEL=info
NODE_ENV=production
SERVICE_NAME=my-service

# Authentication
JWT_SECRET=your-secret-key
JWT_ISSUER=my-app
JWT_AUDIENCE=api

# CORS
CORS_ORIGIN=https://myapp.com,https://admin.myapp.com
ADMIN_CORS_ORIGIN=https://admin.myapp.com

# Feature flags
ALLOW_UNAUTHENTICATED=false
```

## 📚 API Reference

### Middleware Functions
- `authMiddleware(options)` - JWT authentication
- `loggingMiddleware(options)` - Pino logging
- `zodValidationMiddleware(options)` - Zod validation
- `errorHandlerMiddleware(options)` - Error handling
- `corsMiddleware(options)` - CORS configuration

### Pre-configured Handlers
- `createPublicApiHandler()` - Public endpoints
- `createProtectedApiHandler()` - Authenticated endpoints
- `createAdminApiHandler()` - Admin-only endpoints
- `createWebhookHandler()` - Webhook endpoints
- `createInternalHandler()` - Internal service calls

### Utility Functions
- `validateEmail()`, `validateUUID()` - Quick validation
- `parseAndValidate()` - Parse with error handling
- `generateJWT()` - Token generation
- `extractUserId()` - User context extraction

## 🔗 Related Packages

- `@shared/core` - Core utilities with Pino logger
- `@shared/types` - TypeScript type definitions
- `@shared/database` - Database utilities
- `pino@9.7.0` - High-performance logger
- `zod@4.0.5` - TypeScript-first validation

---

## 📝 Notes

- Pino logger is configured for AWS Lambda with JSON output in production
- Zod schemas provide full TypeScript type inference
- All middleware follows the Middy.js execution order
- CORS is environment-aware by default
- Error responses are sanitized in production