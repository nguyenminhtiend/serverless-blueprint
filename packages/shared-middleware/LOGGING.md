# Logging Middleware

The logging middleware automatically logs incoming requests and outgoing responses for all routes processed through the router.

## Features

- Automatic request/response logging
- Configurable on/off switch via environment variables
- Sensitive data masking for security
- Structured logging with request IDs and user information
- Performance timing information

## Usage

### Automatic Integration

The logging middleware is automatically integrated into the router. No additional setup is required for basic functionality.

```typescript
import { createRouter } from '@shared/middleware';

const router = createRouter([
  {
    method: 'POST',
    path: '/api/test',
    handler: myHandler,
  }
]);

// Logging is automatically enabled
export const handler = router;
```

### Manual Integration

You can also manually wrap handlers with logging:

```typescript
import { withLogging } from '@shared/middleware';

const myHandler = async (event, context) => {
  // Handler logic
  return { statusCode: 200, body: 'OK' };
};

// Wrap with logging
export const handler = withLogging(myHandler);
```

### Custom Configuration

```typescript
import { LoggingMiddleware } from '@shared/middleware';

const customLogging = new LoggingMiddleware({
  enabled: true,
  logRequests: true,
  logResponses: true,
  logSensitiveData: false, // Always mask sensitive data in production
  maskFields: ['password', 'token', 'secret'], // Custom fields to mask
});

export const handler = customLogging.wrap(myHandler);
```

## Configuration

### Environment Variables

- `ENABLE_REQUEST_LOGGING`: Set to `"false"` to disable logging (default: `"true"`)

### Options

- `enabled`: Enable/disable logging (default: `true`)
- `logRequests`: Log incoming requests (default: `true`)
- `logResponses`: Log outgoing responses (default: `true`)
- `logSensitiveData`: Include sensitive data in logs (default: `false`)
- `maskFields`: Array of field names to mask (default: `['password', 'token', 'secret', 'key', 'authorization']`)

## Turning Off Logging for Tests

### Environment Variable Method
```bash
export ENABLE_REQUEST_LOGGING=false
npm test
```

### Programmatic Method
```typescript
import { LoggingMiddleware } from '@shared/middleware';

// For tests
const noLogging = new LoggingMiddleware({ enabled: false });
export const handler = noLogging.wrap(myHandler);
```

## Log Format

### Request Logs
```json
{
  "level": "info",
  "message": "Incoming request",
  "requestId": "abc-123",
  "method": "POST",
  "path": "/api/orders",
  "sourceIp": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "userId": "user-123",
  "body": { "item": "value" },
  "queryStringParameters": {},
  "pathParameters": {}
}
```

### Response Logs
```json
{
  "level": "info",
  "message": "Request completed",
  "requestId": "abc-123",
  "statusCode": 200,
  "duration": "150ms"
}
```

### Error Logs
```json
{
  "level": "error",
  "message": "Request completed",
  "requestId": "abc-123",
  "statusCode": 500,
  "duration": "50ms",
  "error": { "error": "Internal server error" }
}
```

## Security

- Sensitive fields are automatically masked in logs
- JWT tokens, passwords, and other secrets are not logged
- User IDs are included for tracing but no personal information
- Request bodies are logged but sensitive fields are masked

## Performance

- Minimal overhead (< 1ms per request)
- Asynchronous logging doesn't block request processing
- Structured JSON format for efficient parsing
- Request timing information included