import middy, { MiddlewareObj, MiddlewareFn } from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationErrorException } from '@shared/core';
import type { ValidationError } from '@shared/types';

export interface ZodValidationOptions {
  inputSchema?: ZodSchema;
  outputSchema?: ZodSchema;
  pathParametersSchema?: ZodSchema;
  queryStringParametersSchema?: ZodSchema;
  headersSchema?: ZodSchema;
  bodySchema?: ZodSchema;
  strict?: boolean;
}

export interface ValidationMiddlewareRequest {
  event: APIGatewayProxyEvent;
  response?: APIGatewayProxyResult;
  error?: Error;
  internal: Record<string, any>;
}

// Zod validation middleware
export const zodValidationMiddleware = (
  options: ZodValidationOptions = {}
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;
    const validationErrors: ValidationError[] = [];

    try {
      // Validate body
      if (options.bodySchema && event.body) {
        let parsedBody;
        try {
          parsedBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (error) {
          validationErrors.push({
            field: 'body',
            message: 'Invalid JSON in request body',
            code: 'INVALID_JSON',
          });
          throw new ValidationErrorException(validationErrors);
        }

        const bodyResult = options.bodySchema.safeParse(parsedBody);
        if (!bodyResult.success) {
          validationErrors.push(...formatZodErrors(bodyResult.error, 'body'));
        } else {
          event.body = JSON.stringify(bodyResult.data);
        }
      }

      // Validate path parameters
      if (options.pathParametersSchema && event.pathParameters) {
        const pathResult = options.pathParametersSchema.safeParse(event.pathParameters);
        if (!pathResult.success) {
          validationErrors.push(...formatZodErrors(pathResult.error, 'pathParameters'));
        } else {
          event.pathParameters = pathResult.data as any;
        }
      }

      // Validate query string parameters
      if (options.queryStringParametersSchema && event.queryStringParameters) {
        const queryResult = options.queryStringParametersSchema.safeParse(
          event.queryStringParameters
        );
        if (!queryResult.success) {
          validationErrors.push(...formatZodErrors(queryResult.error, 'queryStringParameters'));
        } else {
          event.queryStringParameters = queryResult.data as any;
        }
      }

      // Validate headers
      if (options.headersSchema && event.headers) {
        const headersResult = options.headersSchema.safeParse(event.headers);
        if (!headersResult.success) {
          validationErrors.push(...formatZodErrors(headersResult.error, 'headers'));
        }
      }

      // Validate complete input if provided
      if (options.inputSchema) {
        const inputResult = options.inputSchema.safeParse(event);
        if (!inputResult.success) {
          validationErrors.push(...formatZodErrors(inputResult.error));
        }
      }

      if (validationErrors.length > 0) {
        throw new ValidationErrorException(validationErrors);
      }
    } catch (error) {
      if (error instanceof ValidationErrorException) {
        throw error;
      }
      throw new ValidationErrorException([
        {
          field: 'unknown',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      ]);
    }
  };

  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    if (options.outputSchema && request.response) {
      try {
        let responseBody;
        if (request.response.body) {
          responseBody =
            typeof request.response.body === 'string'
              ? JSON.parse(request.response.body)
              : request.response.body;
        }

        const outputResult = options.outputSchema.safeParse(responseBody);
        if (!outputResult.success) {
          // Log validation error but don't throw (response validation is optional in production)
          console.warn('Response validation failed:', formatZodErrors(outputResult.error));
        }
      } catch (error) {
        console.warn('Response validation error:', error);
      }
    }
  };

  return {
    before,
    after,
  };
};

// Convenience functions for specific validation types
export const bodyValidationMiddleware = (
  schema: ZodSchema
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return zodValidationMiddleware({ bodySchema: schema });
};

export const queryValidationMiddleware = (
  schema: ZodSchema
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return zodValidationMiddleware({ queryStringParametersSchema: schema });
};

export const pathValidationMiddleware = (
  schema: ZodSchema
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return zodValidationMiddleware({ pathParametersSchema: schema });
};

export const headersValidationMiddleware = (
  schema: ZodSchema
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return zodValidationMiddleware({ headersSchema: schema });
};

// Custom validation middleware for complex scenarios
export const customValidationMiddleware = (
  validator: (event: APIGatewayProxyEvent) => ValidationError[]
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;

    const errors = validator(event);

    if (errors.length > 0) {
      throw new ValidationErrorException(errors);
    }
  };

  return {
    before,
  };
};

// Helper function to format Zod errors into our ValidationError format
const formatZodErrors = (zodError: ZodError, prefix?: string): ValidationError[] => {
  return zodError.issues.map((error: any) => ({
    field: prefix ? `${prefix}.${error.path.join('.')}` : error.path.join('.'),
    message: error.message,
    code: error.code.toUpperCase(),
    value: error.received,
  }));
};

// Common Zod schemas for reuse
export const schemas = {
  email: z.string().email('Invalid email format').max(254, 'Email too long'),

  uuid: z.string().uuid('Invalid UUID format'),

  positiveInteger: z.number().int().positive('Must be a positive integer'),

  nonEmptyString: z.string().min(1, 'String cannot be empty').max(1000, 'String too long'),

  timestamp: z.string().datetime('Invalid datetime format'),

  pagination: z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    sort: z.string().max(50).optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
  }),

  // HTTP status codes
  httpStatus: z.number().int().min(100).max(599),

  // Common API patterns
  id: z.object({
    id: z.string().uuid(),
  }),

  // Flexible JSON object
  jsonObject: z.record(z.string(), z.unknown()),
};

// Pre-built validation schemas for common use cases
export const commonSchemas = {
  createUser: z.object({
    email: schemas.email,
    name: schemas.nonEmptyString,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long'),
  }),

  updateUser: z
    .object({
      name: schemas.nonEmptyString.optional(),
      email: schemas.email.optional(),
    })
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),

  paginationQuery: schemas.pagination,

  idPath: schemas.id,

  // Generic CRUD schemas
  createRequest: z.object({
    data: z.record(z.string(), z.unknown()),
  }),

  updateRequest: z.object({
    data: z.record(z.string(), z.unknown()),
  }),

  deleteRequest: z.object({
    id: z.string().uuid(),
    force: z.boolean().default(false),
  }),

  // API Response schemas
  successResponse: z.object({
    success: z.literal(true),
    data: z.unknown(),
    metadata: z
      .object({
        timestamp: schemas.timestamp,
        requestId: z.string(),
        version: z.string(),
      })
      .optional(),
  }),

  errorResponse: z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
    metadata: z
      .object({
        timestamp: schemas.timestamp,
        requestId: z.string(),
        version: z.string(),
      })
      .optional(),
  }),
};

// Type inference helpers
export type CreateUserInput = z.infer<typeof commonSchemas.createUser>;
export type UpdateUserInput = z.infer<typeof commonSchemas.updateUser>;
export type PaginationQuery = z.infer<typeof schemas.pagination>;
export type IdPath = z.infer<typeof schemas.id>;

// Validation utility functions
export const validateEmail = (email: string): boolean => {
  return schemas.email.safeParse(email).success;
};

export const validateUUID = (uuid: string): boolean => {
  return schemas.uuid.safeParse(uuid).success;
};

export const parseAndValidate = <T>(schema: ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatZodErrors(result.error);
    throw new ValidationErrorException(errors);
  }
  return result.data;
};

// Transform functions for common cases
export const transformStringToNumber = z.string().transform((val, ctx) => {
  const parsed = parseInt(val);
  if (isNaN(parsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Not a number',
    });
    return z.NEVER;
  }
  return parsed;
});

export const transformStringToBoolean = z.string().transform(val => {
  return val.toLowerCase() === 'true';
});

export const transformEmptyStringToUndefined = z.string().transform(val => {
  return val === '' ? undefined : val;
});
