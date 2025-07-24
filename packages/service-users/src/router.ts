import { createRouter, DELETE, GET, POST, PUT } from '@shared/middleware';
import {
  addAddressHandler,
  deleteAddressHandler,
  getUserProfileHandler,
  updateAddressHandler,
  updateUserProfileHandler,
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
  PUT('/users/profile', updateUserProfileHandler),

  // Address management
  POST('/users/addresses', addAddressHandler),
  PUT('/users/addresses/{id}', updateAddressHandler),
  DELETE('/users/addresses/{id}', deleteAddressHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
