import { createRouter, POST } from '@shared/middleware';
import {
  confirmSignUpHandler,
  forgotPasswordHandler,
  loginHandler,
  registerHandler,
  resetPasswordHandler,
} from './handlers/auth';

/**
 * Create auth service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'auth-service',
    serviceVersion: '1.0.0',
    enableHealthCheck: true,
    enableCorsOptions: true,
  },
  {
    // Minimal middleware options to avoid logger issues
    cors: true,
    jsonBodyParser: true,
  }
);

// Register all auth routes using convenience functions
// Note: API Gateway handles the /auth prefix, so we use simple paths here
addRoutes([
  POST('/auth/login', loginHandler),
  POST('/auth/register', registerHandler),
  POST('/auth/confirm-signup', confirmSignUpHandler),
  POST('/auth/forgot-password', forgotPasswordHandler),
  POST('/auth/reset-password', resetPasswordHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
