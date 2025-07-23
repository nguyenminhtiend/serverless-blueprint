import { createLogger } from '@shared/core';
import { parseValidatedBody } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  OrderPathParamsSchema,
  UpdateOrderStatusRequest,
  UpdateOrderStatusRequestSchema,
} from '../schemas';
import { createOrderService } from '../services';

const logger = createLogger('update-order-status');

/**
 * Update Order Status Handler - Updates order status with event publishing
 */
export const updateOrderStatusHandler = async (
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
    const userEmail = userContext.jwt.claims.email || userId; // Fallback to userId if email not available

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user identifier' }),
      };
    }

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

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    // Body is already parsed by middleware, just validate
    const updateRequest = parseValidatedBody<UpdateOrderStatusRequest>(
      event,
      UpdateOrderStatusRequestSchema
    );

    logger.info('Updating order status', {
      orderId,
      userId,
      newStatus: updateRequest.status,
    });

    // Create services
    const orderService = createOrderService();

    // First, get current order to check ownership and capture previous status
    const currentOrder = await orderService.getOrderById(orderId);

    if (!currentOrder) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Order not found' }),
      };
    }

    // Validate ownership (security check)
    if (currentOrder.userId !== userId) {
      logger.warn('Unauthorized order status update attempt', {
        orderId,
        requestedBy: userId,
        actualOwner: currentOrder.userId,
      });

      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    const previousStatus = currentOrder.status;

    // Update order status
    const updatedOrder = await orderService.updateOrderStatus(orderId, updateRequest, userEmail);

    // Log status change (event publishing for status changes will be implemented in Phase 9)
    if (previousStatus !== updateRequest.status) {
      logger.info('Order status changed', {
        orderId,
        userId,
        previousStatus,
        newStatus: updateRequest.status,
        notes: updateRequest.notes,
      });

      // TODO: Implement ORDER_STATUS_CHANGED and ORDER_CANCELLED events in Phase 9
    }

    logger.info('Order status updated successfully', {
      orderId,
      userId,
      previousStatus,
      newStatus: updateRequest.status,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: updatedOrder,
      }),
    };
  } catch (error) {
    logger.error('Failed to update order status', { error });

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation failed',
          details: JSON.parse(error.message),
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to update order status',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
