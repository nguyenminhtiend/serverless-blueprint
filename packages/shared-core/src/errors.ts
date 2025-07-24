import { HttpStatusCode, type BusinessError, type ValidationError } from '@shared/types';

export abstract class BaseError extends Error implements BusinessError {
  public readonly statusCode: HttpStatusCode;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: HttpStatusCode = 500,
    isOperational = false,
    context?: Record<string, unknown>,
    code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.code = code || this.constructor.name;

    // Ensures the stack trace points to this error
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationErrorException extends BaseError {
  public readonly validationErrors: ValidationError[];

  constructor(errors: ValidationError[], context?: Record<string, unknown>) {
    const message = `Validation failed: ${errors.map(e => e.message).join(', ')}`;
    super(message, 400, true, context);
    this.validationErrors = errors;
    Object.setPrototypeOf(this, ValidationErrorException.prototype);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, identifier?: string, context?: Record<string, unknown>) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, true, context);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized access', context?: Record<string, unknown>) {
    super(message, 401, true, context);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Access forbidden', context?: Record<string, unknown>) {
    super(message, 403, true, context);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, true, context);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class BusinessLogicError extends BaseError {
  public readonly businessError: BusinessError;

  constructor(businessError: BusinessError, context?: Record<string, unknown>) {
    super(businessError.message, 422, true, context);
    this.businessError = businessError;
    Object.setPrototypeOf(this, BusinessLogicError.prototype);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, context?: Record<string, unknown>) {
    super(
      `External service error (${service}): ${message}`,
      HttpStatusCode.BAD_GATEWAY,
      true,
      context
    );
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(
    message = 'Too many requests',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.TOO_MANY_REQUESTS, true, context);
    this.retryAfter = retryAfter;
  }
}

export const isAppError = (error: unknown): error is BaseError => {
  return error instanceof BaseError;
};

export const createBusinessError = (
  code: string,
  message: string,
  context?: Record<string, unknown>
): BusinessError => {
  return { code, message, context };
};

export const formatErrorForLogging = (error: Error): Record<string, unknown> => {
  const baseError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (isAppError(error)) {
    return {
      ...baseError,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
    };
  }

  return baseError;
};

export const sanitizeError = (error: Error): Record<string, unknown> => {
  if (isAppError(error) && error.isOperational) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      ...(error instanceof ValidationErrorException && {
        validationErrors: error.validationErrors,
      }),
    };
  }

  return {
    message: 'Internal server error',
    statusCode: 500,
  };
};
