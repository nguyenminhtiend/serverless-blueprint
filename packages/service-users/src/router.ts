import { createRouter, GET } from '@shared/middleware';
import {
  getUserProfileHandler,
} from './handlers';

/**
 * Create users service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'users-service',
    serviceVersion: '1.0.0',
    enableHealthCheck: true,
  },
  {
    jsonBodyParser: true,
  }
);

// Register all user routes using convenience functions
// Note: API Gateway handles the service prefix routing
addRoutes([
  // Profile management
  GET('/users/profile', getUserProfileHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
