import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { routeRequest } from './router';

/**
 * Orders Service Lambda Handler
 *
 * Main entry point for the orders microservice.
 * Routes requests to appropriate handlers based on HTTP method and path.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return await routeRequest(event);
};

// Export all handlers and services for testing
export * from './handlers';
export * from './services';
export * from './events';
export * from './schemas';
