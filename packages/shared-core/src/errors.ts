import { HttpStatus, type BusinessError, type ValidationError } from '@shared/types'

export class AppError extends Error {
  public readonly statusCode: HttpStatus
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>

  constructor(
    message: string,
    statusCode: HttpStatus = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    
    Object.setPrototypeOf(this, AppError.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationErrorException extends AppError {
  public readonly validationErrors: ValidationError[]

  constructor(errors: ValidationError[], context?: Record<string, any>) {
    const message = `Validation failed: ${errors.map(e => e.message).join(', ')}`
    super(message, 400, true, context)
    this.validationErrors = errors
    Object.setPrototypeOf(this, ValidationErrorException.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string, context?: Record<string, any>) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`
    super(message, 404, true, context)
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access', context?: Record<string, any>) {
    super(message, 401, true, context)
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', context?: Record<string, any>) {
    super(message, 403, true, context)
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context)
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}

export class BusinessLogicError extends AppError {
  public readonly businessError: BusinessError

  constructor(businessError: BusinessError, context?: Record<string, any>) {
    super(businessError.message, 422, true, context)
    this.businessError = businessError
    Object.setPrototypeOf(this, BusinessLogicError.prototype)
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string

  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`External service error (${service}): ${message}`, HttpStatus.BAD_GATEWAY, true, context)
    this.service = service
    Object.setPrototypeOf(this, ExternalServiceError.prototype)
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, context?: Record<string, any>) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, true, context)
    this.retryAfter = retryAfter
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError
}

export const createBusinessError = (code: string, message: string, context?: Record<string, any>): BusinessError => {
  return { code, message, context }
}

export const formatErrorForLogging = (error: Error): Record<string, any> => {
  const baseError = {
    name: error.name,
    message: error.message,
    stack: error.stack
  }

  if (isAppError(error)) {
    return {
      ...baseError,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context
    }
  }

  return baseError
}

export const sanitizeError = (error: Error): Record<string, any> => {
  if (isAppError(error) && error.isOperational) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      ...(error instanceof ValidationErrorException && { 
        validationErrors: error.validationErrors 
      })
    }
  }

  return {
    message: 'Internal server error',
    statusCode: 500
  }
}