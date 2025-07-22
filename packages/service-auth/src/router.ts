import { createRouter, POST, GET } from '@shared/middleware';
import {
  loginHandler,
  registerHandler,
  confirmSignUpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from './handlers/auth';

/**
 * Create auth service router using shared router utilities
 */
const { router, handler, addRoutes } = createRouter(
  {
    serviceName: 'auth-service',
    serviceVersion: '1.0.0',
    basePath: '/auth',
    enableHealthCheck: true,
    enableCorsOptions: true,
  },
  {
    // Middleware options
    logging: { serviceName: 'auth-service' },
    cors: true,
    jsonBodyParser: true,
  }
);

// Register all auth routes using convenience functions
addRoutes([
  POST('/auth/login', loginHandler),
  POST('/auth/register', registerHandler),
  POST('/auth/confirm', confirmSignUpHandler),
  POST('/auth/forgot-password', forgotPasswordHandler),
  POST('/auth/reset-password', resetPasswordHandler),
]);

// Export the configured handler
export { handler };

// Export router instance for testing or additional configuration
export { router };
