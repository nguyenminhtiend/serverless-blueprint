import { createRouter, GET, POST } from '@shared/middleware';
import { createOrderHandler, getOrderHandler } from './handlers';

/**
 * Create orders service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'orders-service',
    serviceVersion: '1.0.0',
    enableHealthCheck: true,
  },
  {
    jsonBodyParser: true,
  }
);

// Register all order routes using convenience functions
// Note: API Gateway handles the service prefix routing
addRoutes([POST('/orders', createOrderHandler), GET('/orders/{orderId}', getOrderHandler)]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
