import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseBody, validateSchema, matchPath, findMatchingRoute, route } from '@shared/core';
import { HttpError } from '@shared/core';
import { APIGatewayProxyEventV2WithJWTAuthorizer, Route } from '@shared/core';

describe('Routing Utils', () => {
  const createMockEvent = (
    body?: string,
    contentType?: string,
    isBase64Encoded = false
  ): APIGatewayProxyEventV2WithJWTAuthorizer => ({
    version: '2.0',
    routeKey: 'POST /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {
      'content-type': contentType || 'application/json',
    },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      http: {
        method: 'POST',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /test',
      stage: 'test',
      time: '2023-01-01T00:00:00.000Z',
      timeEpoch: 1672531200000,
    },
    body,
    isBase64Encoded,
  });

  describe('parseBody', () => {
    it('should parse JSON body', () => {
      const bodyData = { name: 'test', age: 25 };
      const event = createMockEvent(JSON.stringify(bodyData), 'application/json');

      const result = parseBody(event);

      expect(result).toEqual(bodyData);
    });

    it('should parse form-urlencoded body', () => {
      const event = createMockEvent(
        'name=test&age=25&active=true',
        'application/x-www-form-urlencoded'
      );

      const result = parseBody(event);

      expect(result).toEqual({
        name: 'test',
        age: '25',
        active: 'true',
      });
    });

    it('should return raw body for other content types', () => {
      const bodyData = 'plain text data';
      const event = createMockEvent(bodyData, 'text/plain');

      const result = parseBody(event);

      expect(result).toBe(bodyData);
    });

    it('should handle base64 encoded body', () => {
      const bodyData = { message: 'hello' };
      const base64Body = Buffer.from(JSON.stringify(bodyData)).toString('base64');
      const event = createMockEvent(base64Body, 'application/json', true);

      const result = parseBody(event);

      expect(result).toEqual(bodyData);
    });

    it('should return empty object when no body', () => {
      const event = createMockEvent();

      const result = parseBody(event);

      expect(result).toEqual({});
    });

    it('should throw HttpError for invalid JSON', () => {
      const event = createMockEvent('invalid json', 'application/json');

      expect(() => parseBody(event)).toThrow(HttpError);

      try {
        parseBody(event);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(400);
        expect((error as HttpError).message).toBe('Invalid request body format');
      }
    });

    it('should handle Content-Type with uppercase', () => {
      const bodyData = { test: 'value' };
      const event = {
        ...createMockEvent(JSON.stringify(bodyData)),
        headers: { 'Content-Type': 'application/json' },
      };

      const result = parseBody(event);

      expect(result).toEqual(bodyData);
    });

    it('should handle content type with charset', () => {
      const bodyData = { test: 'value' };
      const event = createMockEvent(JSON.stringify(bodyData), 'application/json; charset=utf-8');

      const result = parseBody(event);

      expect(result).toEqual(bodyData);
    });
  });

  describe('validateSchema', () => {
    const userSchema = z.object({
      name: z.string(),
      age: z.number().min(0),
      email: z.string().email(),
    });

    it('should validate and return data when valid', () => {
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      const result = validateSchema(validData, userSchema, 'user data');

      expect(result).toEqual(validData);
    });

    it('should throw HttpError when validation fails', () => {
      const invalidData = {
        name: 'John Doe',
        age: -1, // Invalid age
        email: 'invalid-email', // Invalid email
      };

      expect(() => validateSchema(invalidData, userSchema, 'user data')).toThrow(HttpError);

      try {
        validateSchema(invalidData, userSchema, 'user data');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(400);
        expect((error as HttpError).message).toBe('Validation failed for user data');
        expect((error as HttpError).details).toBeDefined();
        expect(Array.isArray((error as HttpError).details)).toBe(true);
      }
    });

    it('should transform data when schema has transformations', () => {
      const transformSchema = z.object({
        name: z.string().transform(s => s.toUpperCase()),
        age: z.string().transform(s => parseInt(s)),
      });

      const data = { name: 'john', age: '25' };
      const result = validateSchema(data, transformSchema, 'transform data');

      expect(result).toEqual({ name: 'JOHN', age: 25 });
    });

    it('should re-throw non-ZodError errors', () => {
      const errorSchema = z.any().refine(() => {
        throw new Error('Custom error');
      });

      expect(() => validateSchema({}, errorSchema, 'test')).toThrow('Custom error');
    });
  });

  describe('matchPath', () => {
    it('should match exact paths', () => {
      const result = matchPath('/users', '/users');

      expect(result).toEqual({ match: true, params: {} });
    });

    it('should match paths with parameters', () => {
      const result = matchPath('/users/{id}', '/users/123');

      expect(result).toEqual({ match: true, params: { id: '123' } });
    });

    it('should match paths with multiple parameters', () => {
      const result = matchPath('/users/{userId}/posts/{postId}', '/users/123/posts/456');

      expect(result).toEqual({
        match: true,
        params: { userId: '123', postId: '456' },
      });
    });

    it('should decode URL-encoded parameters', () => {
      const result = matchPath('/users/{name}', '/users/John%20Doe');

      expect(result).toEqual({ match: true, params: { name: 'John Doe' } });
    });

    it('should not match paths with different lengths', () => {
      const result = matchPath('/users/{id}', '/users/123/extra');

      expect(result).toEqual({ match: false, params: {} });
    });

    it('should not match paths with different static segments', () => {
      const result = matchPath('/users/{id}', '/posts/123');

      expect(result).toEqual({ match: false, params: {} });
    });

    it('should handle root path', () => {
      const result = matchPath('/', '/');

      expect(result).toEqual({ match: true, params: {} });
    });

    it('should handle empty path segments', () => {
      const result = matchPath('', '');

      expect(result).toEqual({ match: true, params: {} });
    });
  });

  describe('findMatchingRoute', () => {
    const routes: Route[] = [
      {
        method: 'GET',
        path: '/users',
        handler: async () => ({ users: [] }),
      },
      {
        method: 'GET',
        path: '/users/{id}',
        handler: async () => ({ user: {} }),
      },
      {
        method: 'POST',
        path: '/users',
        handler: async () => ({ created: true }),
      },
      {
        method: 'PUT',
        path: '/users/{id}/profile',
        handler: async () => ({ updated: true }),
      },
    ];

    it('should find exact route match', () => {
      const result = findMatchingRoute(routes, 'GET', '/users');

      expect(result).toBeDefined();
      expect(result!.route.method).toBe('GET');
      expect(result!.route.path).toBe('/users');
      expect(result!.params).toEqual({});
    });

    it('should find route with parameters', () => {
      const result = findMatchingRoute(routes, 'GET', '/users/123');

      expect(result).toBeDefined();
      expect(result!.route.method).toBe('GET');
      expect(result!.route.path).toBe('/users/{id}');
      expect(result!.params).toEqual({ id: '123' });
    });

    it('should find route with multiple parameters', () => {
      const result = findMatchingRoute(routes, 'PUT', '/users/123/profile');

      expect(result).toBeDefined();
      expect(result!.route.method).toBe('PUT');
      expect(result!.route.path).toBe('/users/{id}/profile');
      expect(result!.params).toEqual({ id: '123' });
    });

    it('should match case insensitive methods', () => {
      const result = findMatchingRoute(routes, 'get', '/users');

      expect(result).toBeDefined();
      expect(result!.route.method).toBe('GET');
    });

    it('should return null when no route matches', () => {
      const result = findMatchingRoute(routes, 'DELETE', '/users/123');

      expect(result).toBeNull();
    });

    it('should return null when path does not match', () => {
      const result = findMatchingRoute(routes, 'GET', '/posts');

      expect(result).toBeNull();
    });

    it('should find first matching route in order', () => {
      const routesWithConflict: Route[] = [
        {
          method: 'GET',
          path: '/users/{id}',
          handler: async () => ({ type: 'param' }),
        },
        {
          method: 'GET',
          path: '/users/me',
          handler: async () => ({ type: 'exact' }),
        },
      ];

      const result = findMatchingRoute(routesWithConflict, 'GET', '/users/me');

      expect(result).toBeDefined();
      // findMatchingRoute returns the first match, not necessarily exact matches first
      expect(result!.route.path).toBe('/users/{id}');
      expect(result!.params).toEqual({ id: 'me' });
    });
  });

  describe('route', () => {
    it('should create route object with minimal parameters', () => {
      const handler = async () => ({ success: true });

      const result = route({
        method: 'GET',
        path: '/test',
        handler,
      });

      expect(result).toEqual({
        method: 'GET',
        path: '/test',
        handler,
        schema: undefined,
      });
    });

    it('should create route object with schema', () => {
      const handler = async () => ({ success: true });
      const schema = {
        body: z.object({ name: z.string() }),
        query: z.object({ page: z.string() }),
      };

      const result = route({
        method: 'POST',
        path: '/test',
        handler,
        schema,
      });

      expect(result).toEqual({
        method: 'POST',
        path: '/test',
        handler,
        schema,
      });
    });
  });
});
