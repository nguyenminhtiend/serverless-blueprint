import { APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { 
  APIGatewayProxyEventV2WithJWTAuthorizer,
  ParsedEvent,
  LambdaContext
} from './types';

const logger = createLogger('middleware');

export interface LoggingMiddlewareOptions {
  enabled?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  logSensitiveData?: boolean;
  maskFields?: string[];
}

const DEFAULT_MASK_FIELDS = ['password', 'token', 'secret', 'key', 'authorization'];

/**
 * Logging middleware that logs requests and responses
 * Can be configured via environment variables or options
 */
export class LoggingMiddleware {
  private options: Required<LoggingMiddlewareOptions>;

  constructor(options: LoggingMiddlewareOptions = {}) {
    this.options = {
      enabled: options.enabled ?? process.env.ENABLE_REQUEST_LOGGING !== 'false',
      logRequests: options.logRequests ?? true,
      logResponses: options.logResponses ?? true,
      logSensitiveData: options.logSensitiveData ?? false,
      maskFields: options.maskFields ?? DEFAULT_MASK_FIELDS,
    };
  }

  private maskSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const masked = Array.isArray(obj) ? [...obj] : { ...obj };
    
    for (const [key, value] of Object.entries(masked)) {
      const lowerKey = key.toLowerCase();
      if (this.options.maskFields.some(field => lowerKey.includes(field))) {
        masked[key] = '***MASKED***';
      } else if (value && typeof value === 'object') {
        masked[key] = this.maskSensitiveData(value);
      }
    }
    
    return masked;
  }

  private logRequest(event: APIGatewayProxyEventV2WithJWTAuthorizer | ParsedEvent) {
    if (!this.options.enabled || !this.options.logRequests) return;

    const logData: any = {
      requestId: event.requestContext.requestId,
      method: event.requestContext.http.method,
      path: event.requestContext.http.path,
      sourceIp: event.requestContext.http.sourceIp,
      userAgent: event.requestContext.http.userAgent,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
    };

    if (event.body) {
      logData.body = this.options.logSensitiveData 
        ? event.body 
        : this.maskSensitiveData(event.body);
    }

    if (event.requestContext.authorizer?.jwt?.claims) {
      logData.userId = event.requestContext.authorizer.jwt.claims.sub;
    }

    logger.info('Incoming request', logData);
  }

  private logResponse(
    event: APIGatewayProxyEventV2WithJWTAuthorizer | ParsedEvent,
    response: APIGatewayProxyResultV2,
    duration: number
  ) {
    if (!this.options.enabled || !this.options.logResponses) return;

    const statusCode = typeof response === 'object' && 'statusCode' in response 
      ? response.statusCode 
      : 200;

    const logData: any = {
      requestId: event.requestContext.requestId,
      statusCode,
      duration: `${duration}ms`,
    };

    if (typeof response === 'object' && 'body' in response && response.body && statusCode && statusCode >= 400) {
      try {
        const errorBody = JSON.parse(response.body);
        logData.error = this.options.logSensitiveData 
          ? errorBody 
          : this.maskSensitiveData(errorBody);
      } catch {
        logData.error = response.body;
      }
    }

    const logLevel = statusCode && statusCode >= 500 ? 'error' : 
                    statusCode && statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', logData);
  }

  /**
   * Wraps a handler function with logging middleware
   */
  wrap<T extends (...args: any[]) => Promise<APIGatewayProxyResultV2>>(handler: T): T {
    return (async (event: APIGatewayProxyEventV2WithJWTAuthorizer, context: Context) => {
      const startTime = Date.now();

      this.logRequest(event);

      try {
        const result = await handler(event, context);
        const duration = Date.now() - startTime;
        this.logResponse(event, result, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorResponse = {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        };
        this.logResponse(event, errorResponse, duration);
        throw error;
      }
    }) as T;
  }

  /**
   * Logs context for individual handler operations
   */
  logContext(ctx: LambdaContext, operation: string, metadata?: any) {
    if (!this.options.enabled) return;

    const logData: any = {
      requestId: ctx.event.requestContext.requestId,
      operation,
      ...metadata,
    };

    if (ctx.event.requestContext.authorizer?.jwt?.claims) {
      logData.userId = ctx.event.requestContext.authorizer.jwt.claims.sub;
    }

    logger.info(`Operation: ${operation}`, logData);
  }
}

// Create default instance
export const loggingMiddleware = new LoggingMiddleware();

// Export convenience functions
export const withLogging = <T extends (...args: any[]) => Promise<APIGatewayProxyResultV2>>(
  handler: T,
  options?: LoggingMiddlewareOptions
): T => {
  if (options) {
    return new LoggingMiddleware(options).wrap(handler);
  }
  return loggingMiddleware.wrap(handler);
};

export const logOperation = (ctx: LambdaContext, operation: string, metadata?: any) => {
  loggingMiddleware.logContext(ctx, operation, metadata);
};