import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { routeRequest } from './router';

const logger = createLogger('user-service');

/**
 * Main Lambda handler for User Service
 * Routes requests to appropriate handlers based on HTTP method and path
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('User service request received', {
    method: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
  });

  try {
    return await routeRequest(event);
  } catch (error) {
    logger.error('Unhandled error in user service', { error });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: event.requestContext.requestId,
      }),
    };
  }
};

// Export additional handlers and services for testing
export * from './handlers';
export * from './services';
export * from './schemas';
