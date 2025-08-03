// Export main handler using new middleware router (supports HTTP API v2.0 natively)
export { handler } from './router';

// Export individual handlers for alternative deployments (if needed)
export { loginHandler, registerHandler, confirmSignUpHandler } from './handlers/auth';
