import { LambdaContext, ok, forbidden, notFound, internalError, requireUserId } from '@shared/middleware';
import { createOrderService } from '../services';

/**
 * Get Order Handler - Retrieves a specific order by ID
 */
export const getOrderHandler = async (ctx: LambdaContext) => {
  try {
    // Extract user from JWT claims (HTTP API v2.0 JWT authorizer)
    const userId = requireUserId(ctx.event);

    // Path parameters are already parsed and validated by middleware
    const { orderId } = ctx.event.pathParameters;

    // Create service
    const orderService = createOrderService();

    // Get order
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      notFound('Order not found');
      return; // This ensures TypeScript knows order is not null below
    }

    // Validate ownership (security check)
    if (order.userId !== userId) {
      forbidden('Access denied');
      return; // This ensures the function doesn't continue
    }

    return ok({
      success: true,
      data: order,
    });
  } catch (error) {
    internalError(error instanceof Error ? error.message : 'Unknown error during order retrieval');
  }
};
