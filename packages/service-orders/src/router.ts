import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import {
  createOrderHandler,
  getOrderHandler,
  getUserOrdersHandler,
  updateOrderStatusHandler,
} from './handlers';

const logger = createLogger('orders-router');

/**
 * Orders Service Router - Routes requests to appropriate handlers
 *
 * Supported routes:
 * POST /orders              -> createOrderHandler
 * GET /orders               -> getUserOrdersHandler
 * GET /orders/{orderId}     -> getOrderHandler
 * PUT /orders/{orderId}/status -> updateOrderStatusHandler
 */
export const routeRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;
  const pathSegments = path.split('/').filter(segment => segment !== '');

  logger.info('Routing order request', {
    method,
    path,
    pathSegments: pathSegments.length,
  });

  try {
    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
      };
    }

    // Route based on method and path pattern
    switch (method) {
      case 'POST':
        if (pathSegments.length === 1 && pathSegments[0] === 'orders') {
          // POST /orders - Create new order
          return await createOrderHandler(event);
        }
        break;

      case 'GET':
        if (pathSegments.length === 1 && pathSegments[0] === 'orders') {
          // GET /orders - Get user orders (list)
          return await getUserOrdersHandler(event);
        } else if (pathSegments.length === 2 && pathSegments[0] === 'orders') {
          // GET /orders/{orderId} - Get specific order
          return await getOrderHandler(event);
        }
        break;

      case 'PUT':
        if (
          pathSegments.length === 3 &&
          pathSegments[0] === 'orders' &&
          pathSegments[2] === 'status'
        ) {
          // PUT /orders/{orderId}/status - Update order status
          return await updateOrderStatusHandler(event);
        }
        break;

      default:
        logger.warn('Unsupported HTTP method', { method, path });
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Method not allowed',
            supportedMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
          }),
        };
    }

    // If we reach here, the route pattern didn't match
    logger.warn('Route not found', { method, path, pathSegments });
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Route not found',
        availableRoutes: [
          'POST /orders',
          'GET /orders',
          'GET /orders/{orderId}',
          'PUT /orders/{orderId}/status',
        ],
      }),
    };
  } catch (error) {
    logger.error('Router error', { error, method, path });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
