import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { createPublicApiHandler } from '@shared/middleware';
import {
  loginHandler,
  registerHandler,
  confirmSignUpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from './handlers/auth';

const logger = createLogger('auth-router');

/**
 * Route definitions for auth service endpoints
 */
const routes = {
  'POST /auth/login': loginHandler,
  'POST /auth/register': registerHandler,
  'POST /auth/confirm': confirmSignUpHandler,
  'POST /auth/forgot-password': forgotPasswordHandler,
  'POST /auth/reset-password': resetPasswordHandler,
} as const;

/**
 * Main routing handler that distributes requests to appropriate handlers
 */
const routerHandler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path } = event;
  const routeKey = `${httpMethod} ${path}` as keyof typeof routes;

  logger.info('Routing request', {
    method: httpMethod,
    path,
    routeKey,
    requestId: event.requestContext.requestId,
  });

  // Check if route exists
  const handler = routes[routeKey];

  if (!handler) {
    logger.warn('Route not found', { routeKey, availableRoutes: Object.keys(routes) });

    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        availableRoutes: Object.keys(routes),
      }),
    };
  }

  try {
    // Call the specific handler
    const result = await handler(event);

    logger.info('Route handled successfully', {
      routeKey,
      statusCode: result.statusCode,
      requestId: event.requestContext.requestId,
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Route handler error', {
      routeKey,
      error: errorMessage,
      stack: errorStack,
      requestId: event.requestContext.requestId,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: event.requestContext.requestId,
      }),
    };
  }
};

/**
 * Health check handler for monitoring
 */
const healthCheckHandler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      service: 'auth-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      routes: Object.keys(routes),
      environment: process.env.NODE_ENV || 'development',
    }),
  };
};

/**
 * Enhanced router that handles health checks and main routing
 */
const mainRouterHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Handle health check requests
  if (event.httpMethod === 'GET' && event.path === '/auth/health') {
    return await healthCheckHandler(event);
  }

  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify({ message: 'CORS preflight response' }),
    };
  }

  // Delegate to main router
  return await routerHandler(event, context);
};

// Export the handler with middleware stack
export const handler = createPublicApiHandler(mainRouterHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
  jsonBodyParser: true,
  // validation: false, // We'll handle validation in individual handlers - remove this line
});
