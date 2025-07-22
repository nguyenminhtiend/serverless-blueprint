/**
 * Example: Using the Updated Shared Middleware with Pino and Zod
 *
 * This file demonstrates how to use the enhanced middleware package
 * with Pino logging and Zod validation in your Lambda functions.
 */

import { z } from 'zod';
import {
  createPublicApiHandler,
  createProtectedApiHandler,
  createWebhookHandler,
  authMiddleware,
  requireRole,
  zodValidationMiddleware,
  loggingMiddleware,
  commonSchemas,
  schemas,
  LogLevel,
} from '@shared/middleware';
import { createLogger } from '@shared/core';

// ============================================================================
// 1. Basic Public API with Zod Validation
// ============================================================================

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  tags: z.array(z.string()).max(10).default([]),
  published: z.boolean().default(false),
});

type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const createPost = createPublicApiHandler(
  async event => {
    // Type-safe body parsing (already validated by middleware)
    const postData: CreatePostInput = JSON.parse(event.body!);

    // Business logic
    const newPost = {
      id: `post_${Date.now()}`,
      ...postData,
      createdAt: new Date().toISOString(),
    };

    return {
      statusCode: 201,
      body: JSON.stringify(newPost),
    };
  },
  {
    validation: {
      bodySchema: CreatePostSchema,
      // Response validation (optional, for development)
      outputSchema: z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
        published: z.boolean(),
        createdAt: z.string(),
      }),
    },
    logging: {
      logLevel: LogLevel.INFO,
      serviceName: 'blog-service',
      logEvent: true,
    },
    cors: true,
  }
);

// ============================================================================
// 2. Protected API with Authentication and Role-Based Access
// ============================================================================

const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    bio: z.string().max(500).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateUser = createProtectedApiHandler(
  async event => {
    const userId = event.user!.id; // Type-safe user context
    const updateData = JSON.parse(event.body!);

    // Simulate user update
    const updatedUser = {
      id: userId,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(updatedUser),
    };
  },
  {
    secret: process.env.JWT_SECRET!,
    issuer: 'blog-app',
    audience: 'api',
  },
  {
    validation: {
      bodySchema: UpdateUserSchema,
      pathParametersSchema: z.object({
        userId: z.string().uuid(),
      }),
    },
    logging: {
      serviceName: 'user-service',
      logLevel: LogLevel.INFO,
    },
  }
);

// ============================================================================
// 3. Admin-Only Endpoint with Advanced Validation
// ============================================================================

const AdminUserQuerySchema = z.object({
  page: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().min(1).default(1)),
  limit: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().min(1).max(100).default(20)),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
  search: z.string().min(1).optional(),
});

export const adminListUsers = createProtectedApiHandler(
  async event => {
    const query = AdminUserQuerySchema.parse(event.queryStringParameters || {});

    // Simulate user search
    const users = Array.from({ length: query.limit }, (_, i) => ({
      id: `user_${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: query.role || 'user',
      status: query.status || 'active',
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        users,
        pagination: {
          page: query.page,
          limit: query.limit,
          hasMore: users.length === query.limit,
        },
      }),
    };
  },
  { secret: process.env.JWT_SECRET! }
).use(requireRole(['admin'])); // Only admins can access

// ============================================================================
// 4. Webhook Handler with Custom Validation
// ============================================================================

const WebhookPayloadSchema = z.object({
  event: z.enum(['user.created', 'user.updated', 'user.deleted']),
  timestamp: z.string().datetime(),
  data: z.object({
    userId: z.string().uuid(),
    userEmail: z.string().email(),
    changes: z.record(z.unknown()).optional(),
  }),
  signature: z.string(),
});

const WebhookHeadersSchema = z.object({
  'x-webhook-signature': z.string(),
  'x-webhook-timestamp': z.string(),
  'user-agent': z.string().startsWith('WebhookService/'),
});

export const handleWebhook = createWebhookHandler(
  async event => {
    const payload = JSON.parse(event.body!);
    const headers = event.headers;

    // Verify webhook signature (simplified)
    const expectedSignature = calculateSignature(event.body!, process.env.WEBHOOK_SECRET!);
    if (headers['x-webhook-signature'] !== expectedSignature) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    // Process webhook
    console.log('Processing webhook:', payload.event, payload.data.userId);

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  },
  {
    bodySchema: WebhookPayloadSchema,
    headersSchema: WebhookHeadersSchema,
  },
  {
    logging: {
      serviceName: 'webhook-service',
      logEvent: true,
      logResponse: false,
    },
  }
);

// ============================================================================
// 5. Advanced Custom Middleware Setup
// ============================================================================

import middy from '@middy/core';

const CustomBusinessLogicSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  resourceId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const advancedHandler = middy(async (event, context) => {
  const logger = createLogger('advanced-service', {
    requestId: context.awsRequestId,
    operation: event.httpMethod,
  });

  logger.info('Processing advanced request', {
    path: event.path,
    userId: event.user?.id,
  });

  const businessData = JSON.parse(event.body!);

  try {
    // Complex business logic here
    const result = await processBusinessLogic(businessData, event.user!);

    logger.info('Business logic completed', {
      resultId: result.id,
      processingTime: result.processingTime,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error(
      'Business logic failed',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      error instanceof Error ? error : new Error('Unknown error')
    );

    throw error;
  }
})
  // Custom middleware stack
  .use(
    loggingMiddleware({
      serviceName: 'advanced-service',
      logLevel: LogLevel.DEBUG,
      logEvent: true,
      logResponse: true,
    })
  )
  .use(
    zodValidationMiddleware({
      bodySchema: CustomBusinessLogicSchema,
      pathParametersSchema: z.object({
        resourceType: z.enum(['users', 'posts', 'comments']),
        resourceId: z.string().uuid(),
      }),
    })
  )
  .use(
    authMiddleware({
      secret: process.env.JWT_SECRET!,
      optional: false,
    })
  )
  .use(requireRole(['admin', 'operator']));

// ============================================================================
// 6. Schema Composition and Reuse
// ============================================================================

// Base schemas for composition
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const TimestampedSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// Composed schemas
const UserSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  profile: z
    .object({
      bio: z.string().max(500).optional(),
      avatar: z.string().url().optional(),
      preferences: z
        .object({
          notifications: z.boolean().default(true),
          theme: z.enum(['light', 'dark']).default('light'),
        })
        .default({}),
    })
    .optional(),
});

const PostSchema = BaseEntitySchema.extend({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  authorId: z.string().uuid(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).max(10).default([]),
});

// API Response schemas
const UserResponseSchema = z.object({
  success: z.literal(true),
  data: UserSchema,
  metadata: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string(),
  }),
});

export const getUser = createProtectedApiHandler(
  async event => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(event.pathParameters);

    // Simulate user fetch
    const user = {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = {
      success: true as const,
      data: user,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: event.requestContext.requestId,
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  },
  { secret: process.env.JWT_SECRET! },
  {
    validation: {
      outputSchema: UserResponseSchema, // Validate response in development
    },
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

function calculateSignature(payload: string, secret: string): string {
  // Simplified signature calculation
  return `sha256=${Buffer.from(payload + secret).toString('base64')}`;
}

async function processBusinessLogic(data: any, user: any): Promise<any> {
  // Simulate async business logic
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    id: `result_${Date.now()}`,
    operation: data.operation,
    resourceId: data.resourceId,
    processedBy: user.id,
    processingTime: 100,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Type Exports for use in other modules
// ============================================================================

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type User = z.infer<typeof UserSchema>;
export type Post = z.infer<typeof PostSchema>;
