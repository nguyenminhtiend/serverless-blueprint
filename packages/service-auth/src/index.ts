// Export main handler using simple router (avoiding middleware issues)
export { handler } from './simple-router';

// Test with simple handler first
// export { simpleHandler as handler } from './test-handler';

// Export individual handlers for alternative deployments (if needed)
export { login, register, confirmSignUp, forgotPassword, resetPassword } from './handlers/auth';
