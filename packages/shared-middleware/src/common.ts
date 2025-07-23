import middy, { MiddlewareFn, MiddlewareObj, MiddyfiedHandler } from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpMultipartBodyParser from '@middy/http-multipart-body-parser';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authMiddleware, AuthMiddlewareOptions } from './auth';
import { corsMiddleware, CorsOptions, getEnvironmentCors } from './cors';
import { errorHandlerMiddleware, ErrorHandlerOptions } from './error-handler';
import {
  correlationIdsMiddleware,
  loggingMiddleware,
  LoggingMiddlewareOptions,
  performanceMiddleware,
} from './logging';
import { zodValidationMiddleware, ZodValidationOptions } from './validation';

export interface MiddlewareStackOptions {
  // Auth options
  auth?: AuthMiddlewareOptions | boolean;

  // Logging options
  logging?: LoggingMiddlewareOptions | boolean;

  // Error handling options
  errorHandler?: ErrorHandlerOptions | boolean;

  // CORS options
  cors?: CorsOptions | boolean;

  // Validation options
  validation?: ZodValidationOptions;

  // Performance monitoring
  performance?: boolean;

  // Correlation IDs
  correlationIds?: boolean;

  // Event normalization
  normalization?: boolean;

  // Body parsing
  jsonBodyParser?: boolean;
  multipartBodyParser?: boolean;
}

export interface LambdaHandler {
  (event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult>;
}

const DEFAULT_STACK_OPTIONS: MiddlewareStackOptions = {
  auth: false,
  logging: true,
  errorHandler: true,
  cors: true,
  performance: true,
  correlationIds: true,
  normalization: true,
  jsonBodyParser: true,
  multipartBodyParser: false,
};

/**
 * Creates a complete middleware stack for Lambda functions
 * Following the recommended Middy middleware order
 */
export const createMiddlewareStack = (
  handler: LambdaHandler,
  options: MiddlewareStackOptions = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_STACK_OPTIONS, ...options };

  let middlewareStack = middy(handler);

  // 1. Event normalization (should be first)
  if (config.normalization) {
    middlewareStack = middlewareStack.use(httpEventNormalizer()).use(httpHeaderNormalizer());
  }

  // 2. Correlation IDs (early in the chain)
  if (config.correlationIds) {
    middlewareStack = middlewareStack.use(correlationIdsMiddleware());
  }

  // 3. Performance monitoring (early to capture full request time)
  if (config.performance) {
    middlewareStack = middlewareStack.use(performanceMiddleware());
  }

  // 4. Logging (after correlation IDs)
  if (config.logging) {
    const loggingOptions = typeof config.logging === 'boolean' ? {} : config.logging;
    middlewareStack = middlewareStack.use(loggingMiddleware(loggingOptions));
  }

  // 5. Body parsing (before CORS and validation)
  if (config.jsonBodyParser) {
    middlewareStack = middlewareStack.use(httpJsonBodyParser());
  }
  if (config.multipartBodyParser) {
    middlewareStack = middlewareStack.use(httpMultipartBodyParser());
  }

  // 6. CORS (before auth to handle preflight)
  if (config.cors) {
    if (typeof config.cors === 'boolean') {
      middlewareStack = middlewareStack.use(getEnvironmentCors());
    } else {
      middlewareStack = middlewareStack.use(corsMiddleware(config.cors));
    }
  }

  // 7. Validation (before auth and business logic)
  if (config.validation) {
    middlewareStack = middlewareStack.use(zodValidationMiddleware(config.validation));
  }

  // 8. Authentication (after validation, before business logic)
  if (config.auth) {
    const authOptions = typeof config.auth === 'boolean' ? {} : config.auth;
    middlewareStack = middlewareStack.use(authMiddleware(authOptions));
  }

  // 9. Error handling (should be last to catch all errors)
  if (config.errorHandler) {
    const errorOptions = typeof config.errorHandler === 'boolean' ? {} : config.errorHandler;
    middlewareStack = middlewareStack.use(errorHandlerMiddleware(errorOptions));
  }

  return middlewareStack;
};

/**
 * Pre-configured middleware stacks for common scenarios
 */

// Basic API endpoint (no auth required)
export const createPublicApiHandler = (
  handler: LambdaHandler,
  options: Partial<MiddlewareStackOptions> = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return createMiddlewareStack(handler, {
    auth: false,
    cors: true,
    ...options,
  });
};

// Protected API endpoint (auth required)
export const createProtectedApiHandler = (
  handler: LambdaHandler,
  authOptions: AuthMiddlewareOptions = {},
  options: Partial<MiddlewareStackOptions> = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return createMiddlewareStack(handler, {
    auth: authOptions,
    cors: true,
    ...options,
  });
};

// Admin API endpoint (auth + role check)
export const createAdminApiHandler = (
  handler: LambdaHandler,
  options: Partial<MiddlewareStackOptions> = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return createMiddlewareStack(handler, {
    auth: {
      secret: process.env.JWT_SECRET,
    },
    cors: {
      origin: process.env.ADMIN_CORS_ORIGIN?.split(',') || false,
      credentials: true,
    },
    ...options,
  });
};

// Webhook endpoint (public but with validation)
export const createWebhookHandler = (
  handler: LambdaHandler,
  validationSchema: ZodValidationOptions,
  options: Partial<MiddlewareStackOptions> = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return createMiddlewareStack(handler, {
    auth: false,
    cors: false,
    validation: validationSchema,
    logging: {
      logEvent: true,
      logResponse: false,
    },
    ...options,
  });
};

// Internal service endpoint (minimal middleware)
export const createInternalHandler = (
  handler: LambdaHandler,
  options: Partial<MiddlewareStackOptions> = {}
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return createMiddlewareStack(handler, {
    auth: false,
    cors: false,
    normalization: false,
    ...options,
  });
};

/**
 * Utility functions for common middleware combinations
 */

// Centralized body parser and validator - assumes body is already parsed by middleware
export const parseValidatedBody = <T>(event: APIGatewayProxyEvent, schema: any): T => {
  // Body should already be parsed by httpJsonBodyParser middleware
  // This utility only handles validation
  const body = event.body || {};

  if (typeof body === 'string') {
    throw new Error('Body parsing middleware not configured properly - body is still a string');
  }

  return schema.parse(body) as T;
};

// Centralized user context extraction from JWT authorizer
export interface UserContext {
  userId: string;
  email?: string;
  claims: Record<string, any>;
}

export const extractUserContext = (event: APIGatewayProxyEvent): UserContext => {
  const userContext = event.requestContext.authorizer;

  if (!userContext || !userContext.jwt || !userContext.jwt.claims) {
    throw new Error('UNAUTHORIZED');
  }

  const userId = userContext.jwt.claims.sub;
  if (!userId) {
    throw new Error('MISSING_USER_ID');
  }

  return {
    userId,
    email: userContext.jwt.claims.email,
    claims: userContext.jwt.claims,
  };
};

// Helper to create authorization error responses
export const createAuthErrorResponse = (error: string): APIGatewayProxyResult => {
  if (error === 'UNAUTHORIZED') {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  if (error === 'MISSING_USER_ID') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing user identifier' }),
    };
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Authentication error' }),
  };
};

// Combined utility for most common use case - extract user or return error response
export const extractUserOrError = (
  event: APIGatewayProxyEvent
): UserContext | APIGatewayProxyResult => {
  try {
    return extractUserContext(event);
  } catch (error) {
    return createAuthErrorResponse(error instanceof Error ? error.message : 'UNKNOWN');
  }
};

// JSON body parsing middleware
export const jsonBodyParser = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;

    if (event.body && typeof event.body === 'string') {
      try {
        event.body = JSON.parse(event.body);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        throw new Error('Invalid JSON in request body');
      }
    }
  };

  return { before };
};

// Response formatting middleware
export const responseFormatter = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { response } = request;

    if (!response) return;

    // Ensure response has proper structure
    if (!response.statusCode) {
      response.statusCode = 200;
    }

    if (!response.headers) {
      response.headers = {};
    }

    // Ensure Content-Type is set for JSON responses
    if (!response.headers['Content-Type'] && response.body) {
      try {
        JSON.parse(response.body);
        response.headers['Content-Type'] = 'application/json';
      } catch {
        response.headers['Content-Type'] = 'text/plain';
      }
    }

    // Add security headers
    response.headers['X-Content-Type-Options'] = 'nosniff';
    response.headers['X-Frame-Options'] = 'DENY';
    response.headers['X-XSS-Protection'] = '1; mode=block';
  };

  return { after };
};

// Rate limiting middleware (basic implementation)
export const rateLimitMiddleware = (
  options: {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (event: APIGatewayProxyEvent) => string;
  } = {}
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    keyGenerator: (event: APIGatewayProxyEvent) =>
      event.requestContext?.identity?.sourceIp || 'unknown',
    ...options,
  };

  // Simple in-memory store (use Redis in production)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;
    const key = config.keyGenerator(event);
    const now = Date.now();

    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return;
    }

    record.count++;

    if (record.count > config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      request.response = {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
        },
        body: JSON.stringify({
          message: 'Too many requests',
          retryAfter,
        }),
      };
      return;
    }
  };

  return { before };
};

// Request size limit middleware
export const requestSizeLimitMiddleware = (
  maxSizeBytes: number = 1024 * 1024
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;

    if (event.body) {
      const bodySize = Buffer.byteLength(event.body, 'utf8');

      if (bodySize > maxSizeBytes) {
        request.response = {
          statusCode: 413,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Request entity too large',
            maxSize: maxSizeBytes,
            actualSize: bodySize,
          }),
        };
        return;
      }
    }
  };

  return { before };
};
