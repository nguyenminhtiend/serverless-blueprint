import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authMiddleware, AuthMiddlewareOptions } from './auth';
import { loggingMiddleware, correlationIdsMiddleware, performanceMiddleware, LoggingMiddlewareOptions } from './logging';
import { errorHandlerMiddleware, ErrorHandlerOptions } from './error-handler';
import { corsMiddleware, getEnvironmentCors, CorsOptions } from './cors';
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
};

/**
 * Creates a complete middleware stack for Lambda functions
 * Following the recommended Middy middleware order
 */
export const createMiddlewareStack = (
  handler: LambdaHandler,
  options: MiddlewareStackOptions = {}
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_STACK_OPTIONS, ...options };
  
  let middlewareStack = middy(handler);

  // 1. Event normalization (should be first)
  if (config.normalization) {
    middlewareStack = middlewareStack
      .use(httpEventNormalizer())
      .use(httpHeaderNormalizer());
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

  // 5. CORS (before auth to handle preflight)
  if (config.cors) {
    if (typeof config.cors === 'boolean') {
      middlewareStack = middlewareStack.use(getEnvironmentCors());
    } else {
      middlewareStack = middlewareStack.use(corsMiddleware(config.cors));
    }
  }

  // 6. Validation (before auth and business logic)
  if (config.validation) {
    middlewareStack = middlewareStack.use(zodValidationMiddleware(config.validation));
  }

  // 7. Authentication (after validation, before business logic)
  if (config.auth) {
    const authOptions = typeof config.auth === 'boolean' ? {} : config.auth;
    middlewareStack = middlewareStack.use(authMiddleware(authOptions));
  }

  // 8. Error handling (should be last to catch all errors)
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
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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

// JSON body parsing middleware
export const jsonBodyParser = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { event } = request;
    
    if (event.body && typeof event.body === 'string') {
      try {
        event.body = JSON.parse(event.body);
      } catch (error) {
        throw new Error('Invalid JSON in request body');
      }
    }
  };

  return { before };
};

// Response formatting middleware
export const responseFormatter = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
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
export const rateLimitMiddleware = (options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (event: APIGatewayProxyEvent) => string;
} = {}): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    keyGenerator: (event: APIGatewayProxyEvent) => 
      event.requestContext?.identity?.sourceIp || 'unknown',
    ...options,
  };

  // Simple in-memory store (use Redis in production)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
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
export const requestSizeLimitMiddleware = (maxSizeBytes: number = 1024 * 1024): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
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