/**
 * Example: How to create a service router using shared router utilities
 *
 * This example demonstrates different ways to set up routing for microservices
 * Copy this pattern to your service packages
 */

// import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createRouter,
  GET,
  POST,
  PUT,
  DELETE,
  createRouterSuccessResponse,
  createRouterErrorResponse,
  HTTP_STATUS,
  RouteHandler,
} from '../router';
import { z } from 'zod';

// Example schemas for validation
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

// Example handlers
const getUsersHandler: RouteHandler = async _event => {
  // Mock data - replace with actual service logic
  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'user' },
    { id: '2', name: 'Jane Admin', email: 'jane@example.com', role: 'admin' },
  ];

  return createRouterSuccessResponse(users);
};

const getUserHandler: RouteHandler = async event => {
  const userId = event.pathParameters?.id;

  if (!userId) {
    return createRouterErrorResponse(
      'User ID is required',
      'MISSING_USER_ID',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Mock user lookup - replace with actual service logic
  const user = { id: userId, name: 'John Doe', email: 'john@example.com', role: 'user' };

  return createRouterSuccessResponse(user);
};

const createUserHandler: RouteHandler = async event => {
  try {
    // Parse and validate request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const userData = CreateUserSchema.parse(body);

    // Mock user creation - replace with actual service logic
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      createdAt: new Date().toISOString(),
    };

    return createRouterSuccessResponse(newUser, HTTP_STATUS.CREATED, 'User created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createRouterErrorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        HTTP_STATUS.BAD_REQUEST,
        undefined,
        { validationErrors: error.issues }
      );
    }

    throw error; // Let the router handle unexpected errors
  }
};

const updateUserHandler: RouteHandler = async event => {
  const userId = event.pathParameters?.id;

  if (!userId) {
    return createRouterErrorResponse(
      'User ID is required',
      'MISSING_USER_ID',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const updateData = UpdateUserSchema.parse(body);

    // Mock user update - replace with actual service logic
    const updatedUser = {
      id: userId,
      name: 'Updated Name',
      email: 'updated@example.com',
      role: 'user',
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    return createRouterSuccessResponse(updatedUser, HTTP_STATUS.OK, 'User updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createRouterErrorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        HTTP_STATUS.BAD_REQUEST,
        undefined,
        { validationErrors: error.issues }
      );
    }

    throw error;
  }
};

const deleteUserHandler: RouteHandler = async event => {
  const userId = event.pathParameters?.id;

  if (!userId) {
    return createRouterErrorResponse(
      'User ID is required',
      'MISSING_USER_ID',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Mock user deletion - replace with actual service logic

  return createRouterSuccessResponse(null, HTTP_STATUS.OK, `User ${userId} deleted successfully`);
};

// EXAMPLE 1: Basic Service Router
export function createBasicServiceRouter() {
  const { router, handler, addRoutes } = createRouter(
    {
      serviceName: 'user-service',
      serviceVersion: '1.0.0',
      basePath: '/users',
      enableHealthCheck: true,
      enableCorsOptions: true,
    },
    {
      logging: { serviceName: 'user-service' },
      cors: true,
      jsonBodyParser: true,
    }
  );

  // Register routes using convenience functions
  addRoutes([
    GET('/users', getUsersHandler),
    GET('/users/{id}', getUserHandler),
    POST('/users', createUserHandler),
    PUT('/users/{id}', updateUserHandler),
    DELETE('/users/{id}', deleteUserHandler),
  ]);

  return { router, handler };
}

// EXAMPLE 2: Advanced Service Router with Custom Configuration
export function createAdvancedServiceRouter() {
  const { router, handler, addRoute } = createRouter(
    {
      serviceName: 'advanced-service',
      serviceVersion: '2.0.0',
      enableHealthCheck: true,
      enableCorsOptions: false, // Handle CORS manually
    },
    {
      logging: {
        serviceName: 'advanced-service',
        logEvent: true,
        logResponse: false,
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      jsonBodyParser: true,
      multipartBodyParser: true, // Enable file uploads
    }
  );

  // Add routes individually for more control
  addRoute('GET', '/advanced/data', async _event => {
    return createRouterSuccessResponse({
      message: 'Advanced endpoint',
      timestamp: new Date().toISOString(),
    });
  });

  addRoute('POST', '/advanced/upload', async event => {
    // Handle multipart file upload
    const files = (event as any).files; // Parsed by multipart middleware

    return createRouterSuccessResponse({
      message: 'Files uploaded successfully',
      fileCount: files ? Object.keys(files).length : 0,
    });
  });

  return { router, handler };
}

// EXAMPLE 3: Minimal Service Router
export function createMinimalServiceRouter() {
  const { handler, addRoute } = createRouter({
    serviceName: 'minimal-service',
    enableHealthCheck: false, // No health check
    enableCorsOptions: false, // No CORS
  });

  addRoute('GET', '/minimal/ping', async _event => {
    return createRouterSuccessResponse({ pong: true });
  });

  return { handler };
}

// Usage Examples:

// 1. Use in your service's main index.ts:
// const { handler } = createBasicServiceRouter();
// export { handler };

// 2. For testing:
// const { router, handler } = createBasicServiceRouter();
// const routes = router.getRoutes(); // Get all registered routes
// // Test individual routes...

// 3. Add additional routes after creation:
// const { router, handler, addRoute } = createBasicServiceRouter();
// addRoute('GET', '/users/stats', statsHandler);
// export { handler };

export { getUsersHandler, createUserHandler }; // Export for testing
