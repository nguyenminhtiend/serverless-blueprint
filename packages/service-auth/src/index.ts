// Export main handler with internal routing (shared router version)
export { handler } from './router-v2';

// Legacy router (custom implementation)
export { handler as legacyHandler } from './router';

// Export individual handlers for alternative deployments
export { login, register, confirmSignUp, forgotPassword, resetPassword } from './handlers/auth';
