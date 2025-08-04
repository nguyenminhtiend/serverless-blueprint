import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  createRouter,
  HttpError,
  Route,
} from '@shared/middleware';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock the logger
vi.mock('@shared/core', async () => {
  const actual = await vi.importActual('@shared/core');
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      addContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('Router', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  const createMockEvent = (
    method = 'GET',
    path = '/test',
    body?: any,
    claims?: Record<string, any>
  ): APIGatewayProxyEventV2WithJWTAuthorizer => ({
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
    },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: '2023-01-01T00:00:00.000Z',
      timeEpoch: 1672531200000,
      authorizer: claims
        ? {
            jwt: { claims },
          }
        : undefined,
    },
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
    queryStringParameters: null,
    pathParameters: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_REQUEST_LOGGING;
  });

  describe('createRouter', () => {
    it('should handle successful route execution', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const routes: Route[] = [{ method: 'GET', path: '/test', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/test');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(response.body!)).toEqual({ success: true });
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          body: {},
          pathParameters: {},
          queryStringParameters: {},
        }),
        context: mockContext,
      });
    });

    it('should handle route with path parameters', async () => {
      const handler = vi.fn().mockResolvedValue({ userId: '123' });
      const routes: Route[] = [{ method: 'GET', path: '/users/{id}', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/users/123');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          pathParameters: { id: '123' },
        }),
        context: mockContext,
      });
    });

    it('should handle route with query parameters', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [] });
      const routes: Route[] = [{ method: 'GET', path: '/users', handler }];

      const router = createRouter(routes);
      const event = {
        ...createMockEvent('GET', '/users'),
        queryStringParameters: { page: '1', limit: '10' },
      };

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          queryStringParameters: { page: '1', limit: '10' },
        }),
        context: mockContext,
      });
    });

    it('should handle route with body validation', async () => {
      const handler = vi.fn().mockResolvedValue({ created: true });
      const routes: Route[] = [
        {
          method: 'POST',
          path: '/users',
          handler,
          schema: {
            body: z.object({
              name: z.string(),
              email: z.string().email(),
            }),
          },
        },
      ];

      const router = createRouter(routes);
      const bodyData = { name: 'John Doe', email: 'john@example.com' };
      const event = createMockEvent('POST', '/users', bodyData);

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          body: bodyData,
        }),
        context: mockContext,
      });
    });

    it('should handle route with query validation', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [] });
      const routes: Route[] = [
        {
          method: 'GET',
          path: '/users',
          handler,
          schema: {
            query: z.object({
              page: z.string().transform(s => parseInt(s)),
              limit: z.string().transform(s => parseInt(s)),
            }),
          },
        },
      ];

      const router = createRouter(routes);
      const event = {
        ...createMockEvent('GET', '/users'),
        queryStringParameters: { page: '1', limit: '10' },
      };

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          queryStringParameters: { page: 1, limit: 10 },
        }),
        context: mockContext,
      });
    });

    it('should handle route with path parameter validation', async () => {
      const handler = vi.fn().mockResolvedValue({ user: {} });
      const routes: Route[] = [
        {
          method: 'GET',
          path: '/users/{id}',
          handler,
          schema: {
            path: z.object({
              id: z.string().uuid(),
            }),
          },
        },
      ];

      const router = createRouter(routes);
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const event = createMockEvent('GET', `/users/${userId}`);

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          pathParameters: { id: userId },
        }),
        context: mockContext,
      });
    });

    it('should return 404 for non-existent route', async () => {
      const routes: Route[] = [{ method: 'GET', path: '/users', handler: vi.fn() }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/posts');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Route not found: GET /posts');
    });

    it('should return validation error for invalid body', async () => {
      const routes: Route[] = [
        {
          method: 'POST',
          path: '/users',
          handler: vi.fn(),
          schema: {
            body: z.object({
              name: z.string(),
              email: z.string().email(),
            }),
          },
        },
      ];

      const router = createRouter(routes);
      const invalidBody = { name: 'John', email: 'invalid-email' };
      const event = createMockEvent('POST', '/users', invalidBody);

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Validation failed for body');
      expect(body.details).toBeDefined();
    });

    it('should handle handler throwing HttpError', async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new HttpError(400, 'Bad request', { field: 'email' }));
      const routes: Route[] = [{ method: 'GET', path: '/test', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/test');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Bad request');
      expect(body.details).toEqual({ field: 'email' });
    });

    it('should handle handler throwing generic error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Something went wrong'));
      const routes: Route[] = [{ method: 'GET', path: '/test', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/test');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle handler returning pre-formatted response', async () => {
      const preformattedResponse = {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123', created: true }),
      };
      const handler = vi.fn().mockResolvedValue(preformattedResponse);
      const routes: Route[] = [{ method: 'POST', path: '/test', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('POST', '/test');

      const response = await router(event, mockContext);

      expect(response).toBe(preformattedResponse);
    });

    it('should respect ENABLE_REQUEST_LOGGING=false', async () => {
      process.env.ENABLE_REQUEST_LOGGING = 'false';

      const handler = vi.fn().mockResolvedValue({ success: true });
      const routes: Route[] = [{ method: 'GET', path: '/test', handler }];

      const router = createRouter(routes);
      const event = createMockEvent('GET', '/test');

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);

      // Verify logger methods were not called
      const { createLogger } = await import('@shared/core');
      const mockLogger = (createLogger as any)();
      expect(mockLogger.addContext).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should merge existing path parameters with route parameters', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const routes: Route[] = [{ method: 'GET', path: '/users/{id}', handler }];

      const router = createRouter(routes);
      const event = {
        ...createMockEvent('GET', '/users/123'),
        pathParameters: { existing: 'value' },
      };

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          pathParameters: { existing: 'value', id: '123' },
        }),
        context: mockContext,
      });
    });

    it('should handle null query string parameters', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const routes: Route[] = [{ method: 'GET', path: '/test', handler }];

      const router = createRouter(routes);
      const event = {
        ...createMockEvent('GET', '/test'),
        queryStringParameters: null,
      };

      const response = await router(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledWith({
        event: expect.objectContaining({
          queryStringParameters: {},
        }),
        context: mockContext,
      });
    });
  });
});
