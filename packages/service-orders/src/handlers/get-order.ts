import { createLogger } from '@shared/core';
import { extractUserOrError, UserContext } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OrderPathParamsSchema } from '../schemas';
import { createOrderService } from '../services';

const logger = createLogger('get-order');

/**
 * Get Order Handler - Retrieves a specific order by ID
 */
export const getOrderHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context or return error
    const userResult = extractUserOrError(event);
    if ('statusCode' in userResult) {
      return userResult; // Return error response
    }
    const { userId } = userResult as UserContext;

    // Validate path parameters
    if (!event.pathParameters) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing path parameters' }),
      };
    }

    const pathParams = OrderPathParamsSchema.parse(event.pathParameters);
    const { orderId } = pathParams;

    logger.info('Getting order details', { orderId, userId });

    // Create service
    const orderService = createOrderService();

    // Get order
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Order not found' }),
      };
    }

    // Validate ownership (security check)
    if (order.userId !== userId) {
      logger.warn('Unauthorized order access attempt', {
        orderId,
        requestedBy: userId,
        actualOwner: order.userId,
      });

      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    logger.info('Order retrieved successfully', {
      orderId,
      userId,
      status: order.status,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: order,
      }),
    };
  } catch (error) {
    logger.error('Failed to get order', { error });

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid order ID format',
          details: JSON.parse(error.message),
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to retrieve order',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
