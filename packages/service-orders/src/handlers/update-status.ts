import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { createOrderService } from '../services';
import { createOrderEventPublisher } from '../events';
import { OrderPathParamsSchema, UpdateOrderStatusRequestSchema, OrderStatus } from '../schemas';

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
    if (!userContext || !userContext.claims) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userId = userContext.claims.sub;
    const userEmail = userContext.claims.email || userId; // Fallback to userId if email not available

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

    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON format' }),
      };
    }

    // Validate with Zod schema
    const statusUpdate = UpdateOrderStatusRequestSchema.parse(requestData);

    logger.info('Updating order status', {
      orderId,
      userId,
      newStatus: statusUpdate.status,
    });

    // Create services
    const orderService = createOrderService();
    const eventPublisher = createOrderEventPublisher();

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
    const updatedOrder = await orderService.updateOrderStatus(orderId, statusUpdate, userEmail);

    // Publish ORDER_STATUS_CHANGED event (async, don't block response)
    if (previousStatus !== statusUpdate.status) {
      eventPublisher
        .publishOrderStatusChanged(
          orderId,
          userId,
          previousStatus as OrderStatus,
          statusUpdate.status,
          userEmail,
          statusUpdate.notes
        )
        .catch(error => {
          logger.error('Failed to publish ORDER_STATUS_CHANGED event', {
            error,
            orderId,
            previousStatus,
            newStatus: statusUpdate.status,
          });
          // Event publishing failure shouldn't fail the status update
        });

      // Special handling for cancelled orders
      if (statusUpdate.status === 'CANCELLED') {
        eventPublisher
          .publishOrderCancelled(
            orderId,
            userId,
            statusUpdate.notes || 'Order cancelled by customer',
            userEmail
          )
          .catch(error => {
            logger.error('Failed to publish ORDER_CANCELLED event', {
              error,
              orderId,
            });
          });
      }
    }

    logger.info('Order status updated successfully', {
      orderId,
      userId,
      previousStatus,
      newStatus: statusUpdate.status,
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
