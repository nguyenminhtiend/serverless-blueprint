import { APIGatewayProxyEventV2, APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Creates a mock API Gateway Proxy Event V2 for testing purposes.
 * This helper is shared across multiple test files to ensure consistency.
 */
export const createMockEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'GET /users/profile',
  rawPath: '/users/profile',
  rawQueryString: '',
  cookies: [],
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer valid-jwt-token',
  },
  queryStringParameters: {},
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: {
      jwt: {
        claims: {
          sub: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
        },
        scopes: [],
      },
    },
    domainName: 'api.example.com',
    domainPrefix: 'api',
    http: {
      method: 'GET',
      path: '/users/profile',
      protocol: 'HTTP/1.1',
      sourceIp: '192.168.1.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /users/profile',
    stage: 'dev',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  body: null,
  pathParameters: {},
  isBase64Encoded: false,
  stageVariables: {},
  ...overrides,
});

/**
 * Creates a mock API Gateway Proxy Event V2 with JWT Authorizer for router testing.
 * This variant is specifically for testing the router functionality.
 */
export const createMockEventWithJWT = (
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