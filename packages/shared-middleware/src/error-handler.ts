import middy, { MiddlewareObj, MiddlewareFn } from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  AppError, 
  ValidationErrorException, 
  NotFoundError, 
  UnauthorizedError, 
  ForbiddenError,
  ConflictError,
  BusinessLogicError,
  ExternalServiceError,
  RateLimitError,
  isAppError,
  sanitizeError,
  formatErrorForLogging 
} from '@shared/core';
import type { HttpStatus } from '@shared/types';

export interface ErrorHandlerOptions {
  logger?: boolean;
  fallbackMessage?: string;
  exposeStackTrace?: boolean;
  enableCors?: boolean;
  corsOrigin?: string;
}

export interface ErrorMiddlewareRequest {
  event: APIGatewayProxyEvent;
  response?: APIGatewayProxyResult;
  error?: Error;
  internal: {
    coreLogger?: any;
  };
}

const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  logger: true,
  fallbackMessage: 'Internal Server Error',
  exposeStackTrace: process.env.ENVIRONMENT === 'development',
  enableCors: true,
  corsOrigin: '*',
};

export const errorHandlerMiddleware = (options: ErrorHandlerOptions = {}): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const onError: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { error, internal } = request as ErrorMiddlewareRequest;
    
    if (!error) return;

    // Log error if logger is enabled
    if (config.logger && internal.coreLogger) {
      const logData = formatErrorForLogging(error);
      internal.coreLogger.error('Request error occurred', logData, error);
    }

    // Create error response
    const errorResponse = createErrorResponse(error, config);
    
    // Set response
    request.response = errorResponse;
    
    // Don't throw the error again
  };

  return {
    onError,
  };
};

export const createErrorResponse = (error: Error, options: ErrorHandlerOptions = {}): APIGatewayProxyResult => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  let statusCode: HttpStatus = 500;
  let errorBody: any = {
    message: config.fallbackMessage,
    timestamp: new Date().toISOString(),
  };

  // Handle known application errors
  if (isAppError(error)) {
    statusCode = error.statusCode;
    const sanitized = sanitizeError(error);
    errorBody = {
      ...sanitized,
      timestamp: new Date().toISOString(),
    };

    // Add additional context for specific error types
    if (error instanceof ValidationErrorException) {
      errorBody.validationErrors = error.validationErrors;
    } else if (error instanceof BusinessLogicError) {
      errorBody.businessError = error.businessError;
    } else if (error instanceof ExternalServiceError) {
      errorBody.service = error.service;
    } else if (error instanceof RateLimitError && error.retryAfter) {
      errorBody.retryAfter = error.retryAfter;
    }
  } else {
    // Handle unknown errors
    if (config.exposeStackTrace) {
      errorBody.message = error.message;
      errorBody.stack = error.stack;
    }
  }

  // Add error ID for tracking
  errorBody.errorId = generateErrorId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add CORS headers if enabled
  if (config.enableCors) {
    headers['Access-Control-Allow-Origin'] = config.corsOrigin!;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Add retry-after header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(errorBody),
  };
};

export const validationErrorHandler = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const onError: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { error } = request as ErrorMiddlewareRequest;
    
    if (!error) return;

    // Convert common validation errors to our ValidationErrorException
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      const validationError = new ValidationErrorException([
        {
          field: 'unknown',
          message: error.message,
          code: 'VALIDATION_ERROR',
        }
      ]);
      
      request.error = validationError;
    }
  };

  return {
    onError,
  };
};

export const notFoundHandler = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { response } = request as ErrorMiddlewareRequest;
    
    // If no response was set, return 404
    if (!response) {
      request.response = createErrorResponse(
        new NotFoundError('Resource not found'),
        { enableCors: true }
      );
    }
  };

  return {
    after,
  };
};

export const timeoutHandler = (timeoutMs: number = 25000): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError('Request timeout', 408 as any));
      }, timeoutMs);
    });

    // Race between the handler and timeout
    const originalNext = request.internal.next;
    request.internal.next = () => {
      return Promise.race([originalNext(), timeoutPromise]);
    };
  };

  return {
    before,
  };
};

// Helper functions
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Error factory functions for common scenarios
export const createValidationError = (field: string, message: string, code?: string) => {
  return new ValidationErrorException([{
    field,
    message,
    code: code || 'VALIDATION_ERROR',
  }]);
};

export const createNotFoundError = (resource: string, id?: string) => {
  return new NotFoundError(resource, id);
};

export const createUnauthorizedError = (message?: string) => {
  return new UnauthorizedError(message);
};

export const createForbiddenError = (message?: string) => {
  return new ForbiddenError(message);
};

export const createConflictError = (message: string) => {
  return new ConflictError(message);
};

export const createRateLimitError = (retryAfter?: number) => {
  return new RateLimitError('Too many requests', retryAfter);
};

export const createExternalServiceError = (service: string, message: string) => {
  return new ExternalServiceError(service, message);
};