import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { createOrderService } from '../services';
import { createOrderEventPublisher } from '../events';
import { CreateOrderRequestSchema } from '../schemas';

const logger = createLogger('create-order');

/**
 * Create Order Handler - Creates new order with event publishing
 */
export const createOrderHandler = async (
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
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user identifier' }),
      };
    }

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
    const orderRequest = CreateOrderRequestSchema.parse(requestData);

    logger.info('Creating new order', {
      userId,
      itemCount: orderRequest.items.length,
    });

    // Create services
    const orderService = createOrderService();
    const eventPublisher = createOrderEventPublisher();

    // Create order
    const order = await orderService.createOrder(userId, orderRequest);

    // Publish ORDER_CREATED event (async, don't block response)
    eventPublisher.publishOrderCreated(order).catch(error => {
      logger.error('Failed to publish ORDER_CREATED event', {
        error,
        orderId: order.orderId,
      });
      // Event publishing failure shouldn't fail the order creation
      // In production, you might want to retry or use DLQ
    });

    logger.info('Order created successfully', {
      orderId: order.orderId,
      userId: order.userId,
      total: order.total,
    });

    return {
      statusCode: 201,
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
    logger.error('Failed to create order', { error });

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
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
