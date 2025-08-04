import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { Context } from 'aws-lambda';
import { createMockEvent } from '../../../helpers/api-gateway-event';

// Mock the handlers before importing anything else
vi.mock('../../../../packages/service-users/src/handlers', () => ({
  getUserProfileHandler: vi.fn(),
}));

// Now we can import the handler and handlers
import { handler } from '../../../../packages/service-users/src/index';
import * as handlers from '../../../../packages/service-users/src/handlers';

describe('Users Service Router', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-southeast-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  beforeAll(() => {
    // Disable request/response logging during tests
    process.env.ENABLE_REQUEST_LOGGING = 'false';
  });

  afterAll(() => {
    // Clean up environment variable
    delete process.env.ENABLE_REQUEST_LOGGING;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Configuration', () => {
    it('should export handler from index.ts', () => {
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });

  describe('GET /users/profile', () => {
    it('should route to getUserProfileHandler successfully', async () => {
      const mockEvent = createMockEvent();

      const mockHandlerResponse = {
        success: true,
        data: {
          cognitoSub: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
        },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      // Check that handler was called with parsed event (body becomes {})
      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.body).toEqual({});
      expect(callArgs.context).toEqual(mockContext);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body!)).toEqual(mockHandlerResponse);
    });

    it('should handle handler errors gracefully', async () => {
      const mockEvent = createMockEvent({
        headers: {},
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '123e4567-e89b-12d3-a456-426614174000',
              },
              scopes: [],
            },
          },
        },
      });

      const mockError = new Error('Handler failed');
      vi.mocked(handlers.getUserProfileHandler).mockRejectedValue(mockError);

      const result = await handler(mockEvent, mockContext);

      // Router catches errors and returns error response
      expect(result.statusCode).toBe(500);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(JSON.parse(result.body!)).toMatchObject({
        error: 'Internal server error',
      });

      // Check that handler was called
      expect(handlers.getUserProfileHandler).toHaveBeenCalled();
    });

    it('should handle malformed JSON in response body', async () => {
      const mockEvent = createMockEvent({
        body: '{invalid-json}',
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '123e4567-e89b-12d3-a456-426614174000',
              },
              scopes: [],
            },
          },
        },
      });

      const result = await handler(mockEvent, mockContext);

      // Should handle malformed JSON gracefully
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body!)).toMatchObject({
        error: 'Invalid request body format',
      });
    });
  });

  describe('Route not found', () => {
    it('should handle unmatched routes', async () => {
      const mockEvent = createMockEvent({
        routeKey: 'GET /unknown',
        rawPath: '/unknown',
        headers: {},
        queryStringParameters: {},
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: undefined,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'GET',
            path: '/unknown',
          },
          routeKey: 'GET /unknown',
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body!)).toMatchObject({
        error: 'Route not found: GET /unknown',
      });
      expect(handlers.getUserProfileHandler).not.toHaveBeenCalled();
    });

    it('should handle different HTTP methods', async () => {
      const mockEvent = createMockEvent({
        routeKey: 'POST /users/profile',
        headers: {},
        queryStringParameters: {},
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: undefined,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'POST',
          },
          routeKey: 'POST /users/profile',
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body!)).toMatchObject({
        error: 'Route not found: POST /users/profile',
      });
    });
  });

  describe('Request processing', () => {
    it('should handle query parameters', async () => {
      const mockEvent = createMockEvent({
        rawQueryString: 'include=extended&format=json',
        queryStringParameters: {
          include: 'extended',
          format: 'json',
        },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '123e4567-e89b-12d3-a456-426614174000',
              },
              scopes: [],
            },
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { cognitoSub: '123e4567-e89b-12d3-a456-426614174000' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.queryStringParameters).toEqual({
        include: 'extended',
        format: 'json',
      });
      expect(result.statusCode).toBe(200);
    });

    it('should handle empty query parameters', async () => {
      const mockEvent = createMockEvent({
        headers: {},
        queryStringParameters: null,
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '123e4567-e89b-12d3-a456-426614174000',
              },
              scopes: [],
            },
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { cognitoSub: '123e4567-e89b-12d3-a456-426614174000' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.queryStringParameters).toEqual({});
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Request headers and metadata', () => {
    it('should preserve request headers', async () => {
      const mockEvent = createMockEvent({
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test-key',
          'user-agent': 'test-client/1.0',
        },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '123e4567-e89b-12d3-a456-426614174000',
              },
              scopes: [],
            },
          },
          http: {
            ...createMockEvent().requestContext.http,
            userAgent: 'test-client/1.0',
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { cognitoSub: '123e4567-e89b-12d3-a456-426614174000' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      await handler(mockEvent, mockContext);

      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'test-key',
        'user-agent': 'test-client/1.0',
      });
    });
  });

  describe('Path Parameter Validation', () => {
    it('should extract and validate path parameters for GET /users/:userId', async () => {
      const validUserId = '123e4567-e89b-12d3-a456-426614174000';
      const mockEvent = createMockEvent({
        routeKey: 'GET /users/{userId}',
        rawPath: `/users/${validUserId}`,
        pathParameters: { userId: validUserId },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'GET',
            path: `/users/${validUserId}`,
          },
          routeKey: 'GET /users/{userId}',
          authorizer: {
            jwt: {
              claims: { sub: validUserId },
              scopes: [],
            },
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { cognitoSub: validUserId, email: 'test@example.com' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.pathParameters?.userId).toBe(validUserId);
    });

    it('should reject invalid UUID in path parameters', async () => {
      const invalidUserId = 'invalid-uuid';
      const mockEvent = createMockEvent({
        routeKey: 'GET /users/{userId}',
        rawPath: `/users/${invalidUserId}`,
        pathParameters: { userId: invalidUserId },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'GET',
            path: `/users/${invalidUserId}`,
          },
          routeKey: 'GET /users/{userId}',
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body!)).toMatchObject({
        error: expect.stringContaining('path parameters'),
      });
      expect(handlers.getUserProfileHandler).not.toHaveBeenCalled();
    });
  });

  describe('Request Body Schema Validation', () => {
    it('should validate request body for PUT /users/profile', async () => {
      const validUserProfile = {
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Software developer',
        phoneNumber: '+1234567890',
        dateOfBirth: '1990-01-01',
        occupation: 'Engineer',
      };

      const mockEvent = createMockEvent({
        routeKey: 'PUT /users/profile',
        rawPath: '/users/profile',
        body: JSON.stringify(validUserProfile),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'PUT',
            path: '/users/profile',
          },
          routeKey: 'PUT /users/profile',
          authorizer: {
            jwt: {
              claims: { sub: '123e4567-e89b-12d3-a456-426614174000' },
              scopes: [],
            },
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { message: 'Profile updated successfully' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.body).toEqual(validUserProfile);
    });

    it('should reject invalid request body schema', async () => {
      const invalidUserProfile = {
        avatarUrl: 'not-a-valid-url',
        bio: 'x'.repeat(501), // Too long
        phoneNumber: '123', // Too short
        dateOfBirth: 'invalid-date',
        occupation: 'x'.repeat(101), // Too long
      };

      const mockEvent = createMockEvent({
        routeKey: 'PUT /users/profile',
        rawPath: '/users/profile',
        body: JSON.stringify(invalidUserProfile),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'PUT',
            path: '/users/profile',
          },
          routeKey: 'PUT /users/profile',
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body!)).toMatchObject({
        error: expect.stringContaining('body'),
      });
      expect(handlers.getUserProfileHandler).not.toHaveBeenCalled();
    });

    it('should accept optional fields in request body', async () => {
      const minimalUserProfile = {
        bio: 'Simple bio',
      };

      const mockEvent = createMockEvent({
        routeKey: 'PUT /users/profile',
        rawPath: '/users/profile',
        body: JSON.stringify(minimalUserProfile),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'PUT',
            path: '/users/profile',
          },
          routeKey: 'PUT /users/profile',
          authorizer: {
            jwt: {
              claims: { sub: '123e4567-e89b-12d3-a456-426614174000' },
              scopes: [],
            },
          },
        },
      });

      const mockHandlerResponse = {
        success: true,
        data: { message: 'Profile updated successfully' },
      };

      vi.mocked(handlers.getUserProfileHandler).mockResolvedValue(mockHandlerResponse);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const callArgs = vi.mocked(handlers.getUserProfileHandler).mock.calls[0][0];
      expect(callArgs.event.body).toEqual(minimalUserProfile);
    });
  });
});
