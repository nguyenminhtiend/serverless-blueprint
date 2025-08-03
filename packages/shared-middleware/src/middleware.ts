// Lambda Middleware Library
// Install dependencies: npm install zod

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { ZodError, ZodType } from 'zod';

// Types
export interface ParsedEvent
  extends Omit<APIGatewayProxyEventV2, 'body' | 'pathParameters' | 'queryStringParameters'> {
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

// Custom Error Classes
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

// Internal middleware functions
const parseBody = (event: APIGatewayProxyEventV2): any => {
  if (!event.body) return {};

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (contentType.includes('application/json')) {
      return JSON.parse(body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(body));
    }
    return body;
  } catch {
    throw new HttpError(400, 'Invalid request body format');
  }
};

const validateSchema = (data: any, schema: ZodType, fieldName: string): any => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, `Validation failed for ${fieldName}`, error.issues);
    }
    throw error;
  }
};

const matchPath = (
  pattern: string,
  path: string
): { match: boolean; params: Record<string, string> } => {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
};

const createErrorResponse = (error: any): APIGatewayProxyResultV2 => {
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

const createSuccessResponse = (data: any): APIGatewayProxyResultV2 => {
  // If data is already a proper API Gateway response, return it as-is
  if (
    data &&
    typeof data === 'object' &&
    typeof data.statusCode === 'number' &&
    typeof data.body === 'string'
  ) {
    return data;
  }

  // Otherwise create a default success response
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  };
};

// Main API Functions

/**
 * Create a router Lambda handler with multiple routes
 */
export const createRouter = (routes: Route[]) => {
  return async (
    event: APIGatewayProxyEventV2,
    context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    try {
      const method = event.requestContext.http.method;
      const path = event.requestContext.http.path;

      // Find matching route
      const matchedRoute = findMatchingRoute(routes, method, path);
      if (!matchedRoute) {
        throw new HttpError(404, `Route not found: ${method} ${path}`);
      }

      const { route, params } = matchedRoute;

      // Parse and prepare event
      const parsedEvent: ParsedEvent = {
        ...event,
        body: parseBody(event),
        pathParameters: { ...(event.pathParameters || {}), ...params } as Record<string, string>,
        queryStringParameters: event.queryStringParameters
          ? ({ ...event.queryStringParameters } as Record<string, string>)
          : {},
      };

      // Apply validation if schemas provided
      if (route.schema?.body) {
        parsedEvent.body = validateSchema(parsedEvent.body, route.schema.body, 'body');
      }
      if (route.schema?.query) {
        parsedEvent.queryStringParameters = validateSchema(
          parsedEvent.queryStringParameters,
          route.schema.query,
          'query parameters'
        );
      }
      if (route.schema?.path) {
        parsedEvent.pathParameters = validateSchema(
          parsedEvent.pathParameters,
          route.schema.path,
          'path parameters'
        );
      }

      // Execute route handler
      const result = await route.handler({
        event: parsedEvent,
        context,
      });

      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
};

// Helper function to find matching route (extracted for cleaner code)
const findMatchingRoute = (
  routes: Route[],
  method: string,
  path: string
): { route: Route; params: Record<string, string> } | null => {
  for (const route of routes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) {
      continue;
    }

    const { match, params } = matchPath(route.path, path);
    if (match) {
      return { route, params };
    }
  }

  return null;
};

// Convenience function for creating routes
export const route = ({
  method,
  path,
  handler,
  schema,
}: {
  method: string;
  path: string;
  handler: Handler;
  schema?: RouteSchema;
}): Route => ({
  method,
  path,
  handler,
  schema,
});

// Response helpers
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
