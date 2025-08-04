import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  getJWTClaim,
  getJWTClaims,
  getUserEmail,
  getUserId,
  HttpError,
  requireJWTClaims,
  requireUserId,
} from '@shared/middleware';
import { describe, expect, it } from 'vitest';

describe('JWT Utils', () => {
  const createMockEvent = (
    claims?: Record<string, any>
  ): APIGatewayProxyEventV2WithJWTAuthorizer => ({
    version: '2.0',
    routeKey: 'GET /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: 'GET /test',
      stage: 'test',
      time: '2023-01-01T00:00:00.000Z',
      timeEpoch: 1672531200000,
      authorizer: claims
        ? {
            jwt: {
              claims,
            },
          }
        : undefined,
    },
    isBase64Encoded: false,
  });

  describe('getJWTClaims', () => {
    it('should return JWT claims when present', () => {
      const claims = { sub: 'user-123', email: 'test@example.com', role: 'user' };
      const event = createMockEvent(claims);

      const result = getJWTClaims(event);

      expect(result).toEqual(claims);
    });

    it('should return null when no JWT authorizer', () => {
      const event = createMockEvent();

      const result = getJWTClaims(event);

      expect(result).toBeNull();
    });

    it('should return null when no JWT claims', () => {
      const event = createMockEvent({});

      const result = getJWTClaims(event);

      expect(result).toEqual({});
    });
  });

  describe('getJWTClaim', () => {
    it('should return specific claim value', () => {
      const claims = { sub: 'user-123', email: 'test@example.com', age: 25, active: true };
      const event = createMockEvent(claims);

      expect(getJWTClaim(event, 'sub')).toBe('user-123');
      expect(getJWTClaim(event, 'email')).toBe('test@example.com');
      expect(getJWTClaim(event, 'age')).toBe(25);
      expect(getJWTClaim(event, 'active')).toBe(true);
    });

    it('should return undefined for non-existent claim', () => {
      const claims = { sub: 'user-123' };
      const event = createMockEvent(claims);

      const result = getJWTClaim(event, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no claims', () => {
      const event = createMockEvent();

      const result = getJWTClaim(event, 'sub');

      expect(result).toBeUndefined();
    });
  });

  describe('getUserId', () => {
    it('should return user ID from sub claim', () => {
      const claims = { sub: 'user-123', email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = getUserId(event);

      expect(result).toBe('user-123');
    });

    it('should return undefined when sub is not a string', () => {
      const claims = { sub: 123, email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = getUserId(event);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no sub claim', () => {
      const claims = { email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = getUserId(event);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no claims', () => {
      const event = createMockEvent();

      const result = getUserId(event);

      expect(result).toBeUndefined();
    });
  });

  describe('getUserEmail', () => {
    it('should return user email from email claim', () => {
      const claims = { sub: 'user-123', email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = getUserEmail(event);

      expect(result).toBe('test@example.com');
    });

    it('should return undefined when email is not a string', () => {
      const claims = { sub: 'user-123', email: true };
      const event = createMockEvent(claims);

      const result = getUserEmail(event);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no email claim', () => {
      const claims = { sub: 'user-123' };
      const event = createMockEvent(claims);

      const result = getUserEmail(event);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no claims', () => {
      const event = createMockEvent();

      const result = getUserEmail(event);

      expect(result).toBeUndefined();
    });
  });

  describe('requireJWTClaims', () => {
    it('should return claims when present', () => {
      const claims = { sub: 'user-123', email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = requireJWTClaims(event);

      expect(result).toEqual(claims);
    });

    it('should throw HttpError when no claims', () => {
      const event = createMockEvent();

      expect(() => requireJWTClaims(event)).toThrow(HttpError);

      try {
        requireJWTClaims(event);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(401);
        expect((error as HttpError).message).toBe('JWT claims not found in request context');
      }
    });

    it('should return empty claims object when claims is empty', () => {
      const event = createMockEvent({});

      const result = requireJWTClaims(event);

      expect(result).toEqual({});
    });
  });

  describe('requireUserId', () => {
    it('should return user ID when present', () => {
      const claims = { sub: 'user-123', email: 'test@example.com' };
      const event = createMockEvent(claims);

      const result = requireUserId(event);

      expect(result).toBe('user-123');
    });

    it('should throw HttpError when no user ID', () => {
      const event = createMockEvent();

      expect(() => requireUserId(event)).toThrow(HttpError);

      try {
        requireUserId(event);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(401);
        expect((error as HttpError).message).toBe('User ID (sub claim) not found in JWT');
      }
    });

    it('should throw HttpError when sub is not a string', () => {
      const claims = { sub: 123 };
      const event = createMockEvent(claims);

      expect(() => requireUserId(event)).toThrow(HttpError);

      try {
        requireUserId(event);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(401);
        expect((error as HttpError).message).toBe('User ID (sub claim) not found in JWT');
      }
    });

    it('should throw HttpError when sub claim is missing', () => {
      const claims = { email: 'test@example.com' };
      const event = createMockEvent(claims);

      expect(() => requireUserId(event)).toThrow(HttpError);

      try {
        requireUserId(event);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(401);
        expect((error as HttpError).message).toBe('User ID (sub claim) not found in JWT');
      }
    });
  });
});
