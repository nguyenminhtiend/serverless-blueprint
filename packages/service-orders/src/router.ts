import { createRouter, POST, GET, PUT } from '@shared/middleware';
import {
  createOrderHandler,
  getOrderHandler,
  getUserOrdersHandler,
  updateOrderStatusHandler,
} from './handlers';

/**
 * Create orders service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'orders-service',
    serviceVersion: '1.0.0',
    enableHealthCheck: true,
    enableCorsOptions: true,
  },
  {
    cors: true,
    jsonBodyParser: true,
  }
);

// Register all order routes using convenience functions
// Note: API Gateway handles the service prefix routing
addRoutes([
  POST('/orders', createOrderHandler),
  GET('/orders', getUserOrdersHandler),
  GET('/orders/{orderId}', getOrderHandler),
  PUT('/orders/{orderId}/status', updateOrderStatusHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
