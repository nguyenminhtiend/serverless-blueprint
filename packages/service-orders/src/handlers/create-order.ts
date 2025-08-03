import { createLogger } from '@shared/core';
import { LambdaContext, created, internalError, requireUserId } from '@shared/middleware';
import { createOrderCreatedEvent, publishOrderCreatedEvent } from '../events';
import { CreateOrderRequest } from '../schemas';
import { createOrderService } from '../services';

const logger = createLogger('create-order');

/**
 * Create Order Handler - Creates new order with event publishing
 */
export const createOrderHandler = async (ctx: LambdaContext) => {
  try {
    // Extract user from JWT claims (HTTP API v2.0 JWT authorizer)
    const userId = requireUserId(ctx.event);

    // Body is already parsed and validated by middleware
    const orderRequest: CreateOrderRequest = ctx.event.body;

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
          correlationId: ctx.event.requestContext.requestId, // Use request ID for correlation
        }
      );

      // Publish event synchronously to ensure it completes before Lambda ends
      try {
        const publishResult = await publishOrderCreatedEvent(orderCreatedEvent);

        logger.info('ORDER_CREATED event published successfully', {
          orderId: order.orderId,
          eventId: orderCreatedEvent.eventId,
          success: publishResult.success,
          eventBridgeEventId: publishResult.eventId,
        });
      } catch (error) {
        logger.error('Failed to publish ORDER_CREATED event', {
          error: error instanceof Error ? error.message : String(error),
          orderId: order.orderId,
          eventId: orderCreatedEvent.eventId,
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Event publishing failure shouldn't fail the order creation
        // In production, you might want to retry or use DLQ
      }

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

    return created({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error('Failed to create order', { error });
    internalError(error instanceof Error ? error.message : 'Unknown error during order creation');
  }
};
