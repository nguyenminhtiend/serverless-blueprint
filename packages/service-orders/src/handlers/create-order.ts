import { LambdaContext, created, internalError, requireUserId } from '@shared/middleware';
import { createOrderCreatedEvent, publishOrderCreatedEvent } from '../events';
import { CreateOrderRequest } from '../schemas';
import { createOrderService } from '../services';

/**
 * Create Order Handler - Creates new order with event publishing
 */
export const createOrderHandler = async (ctx: LambdaContext) => {
  // Extract user from JWT claims (HTTP API v2.0 JWT authorizer)
  const userId = requireUserId(ctx.event);

  // Body is already parsed and validated by middleware
  const orderRequest: CreateOrderRequest = ctx.event.body;

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

    await publishOrderCreatedEvent(orderCreatedEvent);

    return created({
      success: true,
      data: order,
    });
  } catch (error) {
    internalError(error instanceof Error ? error.message : 'Unknown error during order creation');
  }
};
