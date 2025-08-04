import { createRouter, route } from '@shared/core';
import { createOrderHandler, getOrderHandler } from './handlers';
import { CreateOrderRequestSchema, OrderPathParamsSchema } from './schemas';

/**
 * Create orders service router using new middleware
 */
export const handler = createRouter([
  route({
    method: 'POST',
    path: '/orders',
    handler: createOrderHandler,
    schema: { body: CreateOrderRequestSchema },
  }),
  route({
    method: 'GET',
    path: '/orders/{orderId}',
    handler: getOrderHandler,
    schema: { path: OrderPathParamsSchema },
  }),
]);
