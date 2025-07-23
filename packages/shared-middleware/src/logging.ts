import { MiddlewareObj, MiddlewareFn } from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger, LogLevel, PinoLogContext as LogContext, PinoLogger as Logger } from '@shared/core';
import type { AuthenticatedEvent } from './auth';

export interface LoggingMiddlewareOptions {
  logLevel?: LogLevel;
  serviceName?: string;
  logEvent?: boolean;
  logResponse?: boolean;
  enableTracing?: boolean;
  redactPaths?: string[];
  prettyPrint?: boolean;
}

export interface LoggingRequest {
  event: AuthenticatedEvent;
  context: Context;
  response?: APIGatewayProxyResult;
  error?: Error;
  internal: {
    logger?: Logger;
    startTime?: number;
  };
}

const DEFAULT_OPTIONS: LoggingMiddlewareOptions = {
  logLevel: LogLevel.INFO,
  serviceName: process.env.SERVICE_NAME || 'unknown-service',
  logEvent: true,
  logResponse: false,
  enableTracing: true,
  redactPaths: ['password', 'token', 'authorization', 'x-api-key'],
  prettyPrint: process.env.NODE_ENV !== 'production',
};

export const loggingMiddleware = (
  options: LoggingMiddlewareOptions = {}
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event, context, internal } = request;

    // Initialize logger
    const logContext: LogContext = {
      requestId: context.awsRequestId,
      service: config.serviceName!,
      operation: `${event.httpMethod} ${event.path}`,
      userId: event.user?.id,
      correlationId: event.headers?.['x-correlation-id'],
    };

    const logger = createLogger(config.serviceName!, logContext, {
      level: config.logLevel,
      prettyPrint: config.prettyPrint,
    });

    internal.logger = logger;
    internal.startTime = Date.now();

    // Log incoming request
    if (config.logEvent) {
      const sanitizedEvent = redactSensitiveData(event, config.redactPaths!);
      logger.info('Incoming request', {
        httpMethod: event.httpMethod,
        path: event.path,
        userAgent: event.headers?.['User-Agent'],
        sourceIp: event.requestContext?.identity?.sourceIp,
        ...(config.logLevel === LogLevel.DEBUG && { event: sanitizedEvent }),
      });
    }
  };

  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { response, internal } = request;
    const { logger, startTime } = internal;

    if (!logger || !startTime) return;

    const duration = Date.now() - startTime;
    const statusCode = response?.statusCode || 200;

    // Log response
    logger.info('Request completed', {
      statusCode,
      duration,
      ...(config.logResponse &&
        response && {
          response: redactSensitiveData(response, config.redactPaths!),
        }),
    });
  };

  const onError: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { error, internal } = request;
    const { logger, startTime } = internal;

    if (!logger || !error || !startTime) return;

    const duration = Date.now() - startTime;

    logger.error(
      'Request failed',
      {
        duration,
        errorName: error.name,
        errorMessage: error.message,
      },
      error
    );
  };

  return {
    before,
    after,
    onError,
  };
};

export const correlationIdsMiddleware = (): MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;

    // Generate correlation ID if not present
    if (!event.headers?.['x-correlation-id']) {
      const correlationId = generateCorrelationId();
      event.headers = event.headers || {};
      event.headers['x-correlation-id'] = correlationId;
    }
  };

  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { event, response } = request;

    if (response && event.headers?.['x-correlation-id']) {
      response.headers = response.headers || {};
      response.headers['X-Correlation-ID'] = event.headers['x-correlation-id'];
    }
  };

  return {
    before,
    after,
  };
};

export const performanceMiddleware = (): MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { internal } = request;
    internal.startTime = Date.now();
  };

  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { context, internal, response } = request;
    const { startTime } = internal;

    if (!startTime) return;

    const duration = Date.now() - startTime;
    const memoryUsed = Math.round(Number(context.memoryLimitInMB) * 0.8); // Approximate memory usage

    if (response) {
      response.headers = response.headers || {};
      response.headers['X-Response-Time'] = `${duration}ms`;
      response.headers['X-Memory-Used'] = `${memoryUsed}MB`;
    }

    // Log performance metrics
    if (internal.logger) {
      internal.logger.info('Performance metrics', {
        duration,
        memoryUsed,
        remainingTime: context.getRemainingTimeInMillis(),
      });
    }
  };

  return {
    before,
    after,
  };
};

// Helper functions
const redactSensitiveData = (obj: any, redactPaths: string[]): any => {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const [key, value] of Object.entries(redacted)) {
    const lowerKey = key.toLowerCase();

    if (redactPaths.some(path => lowerKey.includes(path.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, redactPaths);
    }
  }

  return redacted;
};

const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Export logger instance for use in handlers
export const getLogger = (request: any): Logger | undefined => {
  return request.internal.logger;
};
