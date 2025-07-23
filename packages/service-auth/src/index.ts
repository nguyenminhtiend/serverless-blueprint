// Export main handler using shared middleware router (supports HTTP API v2.0 natively)
export { handler } from './router';

// Export individual handlers for alternative deployments (if needed)
export { login, register, confirmSignUp, forgotPassword, resetPassword } from './handlers/auth';
