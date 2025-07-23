import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import {
  getUserProfileHandler,
  updateUserProfileHandler,
  addAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
} from './handlers';

const logger = createLogger('user-service-router');

/**
 * Route user service requests based on HTTP method and path
 */
export const routeRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('Routing user service request', { method, path });

  try {
    // Profile endpoints
    if (path === '/users/profile') {
      switch (method) {
        case 'GET':
          return await getUserProfileHandler(event);
        case 'PUT':
          return await updateUserProfileHandler(event);
        default:
          return methodNotAllowed(method, path);
      }
    }

    // Address management endpoints
    if (path === '/users/addresses') {
      switch (method) {
        case 'POST':
          return await addAddressHandler(event);
        default:
          return methodNotAllowed(method, path);
      }
    }

    // Specific address endpoints with ID
    if (path.match(/^\/users\/addresses\/[a-f0-9-]{36}$/)) {
      switch (method) {
        case 'PUT':
          return await updateAddressHandler(event);
        case 'DELETE':
          return await deleteAddressHandler(event);
        default:
          return methodNotAllowed(method, path);
      }
    }

    // Path not found
    return notFound(path);
  } catch (error) {
    logger.error('Router error', { method, path, error });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
      }),
    };
  }
};

/**
 * Handle method not allowed
 */
function methodNotAllowed(method: string, path: string): APIGatewayProxyResult {
  logger.warn('Method not allowed', { method, path });

  return {
    statusCode: 405,
    headers: {
      'Content-Type': 'application/json',
      Allow: getAllowedMethods(path),
    },
    body: JSON.stringify({
      error: 'Method Not Allowed',
      message: `${method} method is not allowed for ${path}`,
      allowedMethods: getAllowedMethods(path).split(', '),
    }),
  };
}

/**
 * Handle path not found
 */
function notFound(path: string): APIGatewayProxyResult {
  logger.warn('Path not found', { path });

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not Found',
      message: `Path ${path} not found`,
      availablePaths: [
        'GET /users/profile',
        'PUT /users/profile',
        'POST /users/addresses',
        'PUT /users/addresses/{id}',
        'DELETE /users/addresses/{id}',
      ],
    }),
  };
}

/**
 * Get allowed methods for a given path
 */
function getAllowedMethods(path: string): string {
  switch (path) {
    case '/users/profile':
      return 'GET, PUT';
    case '/users/addresses':
      return 'POST';
    default:
      // For address ID paths
      if (path.match(/^\/users\/addresses\/[a-f0-9-]{36}$/)) {
        return 'PUT, DELETE';
      }
      return '';
  }
}
