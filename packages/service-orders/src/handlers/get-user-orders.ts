import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { createOrderService } from '../services';
import { GetUserOrdersQuerySchema } from '../schemas';

const logger = createLogger('get-user-orders');

/**
 * Get User Orders Handler - Retrieves paginated list of user's orders
 */
export const getUserOrdersHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT (added by API Gateway JWT authorizer)
    const userContext = event.requestContext.authorizer;
    if (!userContext || !userContext.jwt || !userContext.jwt.claims) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userId = userContext.jwt.claims.sub;
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user identifier' }),
      };
    }

    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const query = GetUserOrdersQuerySchema.parse(queryParams);

    logger.info('Getting user orders', {
      userId,
      limit: query.limit,
      status: query.status,
      hasPagination: !!query.startKey,
    });

    // Create service
    const orderService = createOrderService();

    // Get user orders with pagination
    const result = await orderService.getUserOrders(userId, query);

    logger.info('User orders retrieved successfully', {
      userId,
      orderCount: result.orders.length,
      hasMore: !!result.lastEvaluatedKey,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          orders: result.orders,
          pagination: {
            limit: query.limit,
            nextKey: result.lastEvaluatedKey,
            hasMore: !!result.lastEvaluatedKey,
          },
        },
      }),
    };
  } catch (error) {
    logger.error('Failed to get user orders', { error });

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid query parameters',
          details: JSON.parse(error.message),
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to retrieve orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
