// Basic types only - all others are unused
export type UUID = string;
export type ISO8601 = string;

// Core types that should be shared across all packages
import { APIGatewayProxyEventV2, Context, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodType } from 'zod';

export interface APIGatewayProxyEventV2WithJWTAuthorizer extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims: Record<string, string | number | boolean>;
        scopes?: string[] | null;
      };
      lambda?: Record<string, any>;
      iam?: {
        accessKey: string;
        accountId: string;
        callerId: string;
        cognitoAuthenticationProvider?: string;
        cognitoAuthenticationType?: string;
        cognitoIdentityId?: string;
        cognitoIdentityPoolId?: string;
        principalOrgId?: string;
        sourceIp: string;
        user: string;
        userAgent: string;
        userArn: string;
      };
    };
  };
}

export type JWTClaims = Record<string, string | number | boolean>;

export interface ParsedEvent
  extends Omit<APIGatewayProxyEventV2WithJWTAuthorizer, 'body' | 'pathParameters' | 'queryStringParameters'> {
  body: any;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
}

export interface LambdaContext {
  event: ParsedEvent;
  context: Context;
}

export type Handler = (ctx: LambdaContext) => Promise<any> | any;

export interface RouteSchema {
  body?: ZodType;
  query?: ZodType;
  path?: ZodType;
}

export interface Route {
  method: string;
  path: string;
  handler: Handler;
  schema?: RouteSchema;
}

// Error handling types
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Response helpers
export const createErrorResponse = (error: any): APIGatewayProxyResultV2 => {
  console.error('Lambda execution error:', error);

  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }),
  };
};

export const createSuccessResponse = (data: any): APIGatewayProxyResultV2 => {
  if (
    data &&
    typeof data === 'object' &&
    typeof data.statusCode === 'number' &&
    typeof data.body === 'string'
  ) {
    return data;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  };
};

export const badRequest = (message: string, details?: any): never => {
  throw new HttpError(400, message, details);
};

export const unauthorized = (message: string = 'Unauthorized'): never => {
  throw new HttpError(401, message);
};

export const forbidden = (message: string = 'Forbidden'): never => {
  throw new HttpError(403, message);
};

export const notFound = (message: string = 'Not found'): never => {
  throw new HttpError(404, message);
};

export const conflict = (message: string, details?: any): never => {
  throw new HttpError(409, message, details);
};

export const internalError = (message: string = 'Internal server error', details?: any): never => {
  throw new HttpError(500, message, details);
};

export const ok = (data: any): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const created = (data: any): APIGatewayProxyResultV2 => ({
  statusCode: 201,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const noContent = (): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: { 'Content-Type': 'application/json' },
  body: '',
});