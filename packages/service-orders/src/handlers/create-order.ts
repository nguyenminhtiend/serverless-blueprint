import { createLogger } from '@shared/core';
import { parseValidatedBody } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createOrderCreatedEvent, publishOrderCreatedEvent } from '../events';
import { CreateOrderRequest, CreateOrderRequestSchema } from '../schemas';
import { createOrderService } from '../services';

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

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    // Body is already parsed by middleware, just validate
    const orderRequest = parseValidatedBody<CreateOrderRequest>(event, CreateOrderRequestSchema);

    logger.info('Creating new order', {
      userId,
      itemCount: orderRequest.items.length,
    });

    // Create order service
    const orderService = createOrderService();

    // Create order
    const order = await orderService.createOrder(userId, orderRequest);

    // Create and publish ORDER_CREATED event (async, don't block response)
    try {
      const orderCreatedEvent = createOrderCreatedEvent(
        order.orderId,
        order.userId,
        {
          orderId: order.orderId,
          userId: order.userId,
          status: 'PENDING',
          total: order.total,
          itemCount: order.itemCount || order.items.length,
          items: order.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.subtotal, // Use subtotal from existing schema
          })),
          shipping: {
            address: `${order.shippingAddress.street}`,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zipCode: order.shippingAddress.zipCode,
            country: order.shippingAddress.country,
          },
          payment: {
            method: order.paymentInfo.method.toUpperCase() as any, // Convert to uppercase enum
            currency: 'USD', // Default currency
          },
        },
        {
          correlationId: event.requestContext.requestId, // Use request ID for correlation
        }
      );

      // Publish event asynchronously
      publishOrderCreatedEvent(orderCreatedEvent).catch(error => {
        logger.error('Failed to publish ORDER_CREATED event', {
          error: error instanceof Error ? error.message : error,
          orderId: order.orderId,
          eventId: orderCreatedEvent.eventId,
        });
        // Event publishing failure shouldn't fail the order creation
        // In production, you might want to retry or use DLQ
      });

      logger.info('ORDER_CREATED event initiated', {
        orderId: order.orderId,
        eventId: orderCreatedEvent.eventId,
      });
    } catch (eventError) {
      logger.error('Failed to create ORDER_CREATED event', {
        error: eventError instanceof Error ? eventError.message : eventError,
        orderId: order.orderId,
      });
      // Continue even if event creation fails
    }

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
