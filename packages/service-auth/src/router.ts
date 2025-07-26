import { createRouter, POST } from '@shared/middleware';
import {
  confirmSignUpHandler,
  loginHandler,
  registerHandler,
} from './handlers/auth';

/**
 * Create auth service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'auth-service',
    serviceVersion: '1.0.0',
    enableHealthCheck: true,
  },
  {
    // Minimal middleware options to avoid logger issues
    jsonBodyParser: true,
  }
);

// Register all auth routes using convenience functions
// Note: API Gateway handles the /auth prefix, so we use simple paths here
addRoutes([
  POST('/auth/login', loginHandler),
  POST('/auth/register', registerHandler),
  POST('/auth/confirm-signup', confirmSignUpHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
