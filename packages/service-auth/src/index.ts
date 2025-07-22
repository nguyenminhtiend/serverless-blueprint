// Export main handler using shared router
export { handler } from './router';

// Export individual handlers for alternative deployments (if needed)
export { login, register, confirmSignUp, forgotPassword, resetPassword } from './handlers/auth';
