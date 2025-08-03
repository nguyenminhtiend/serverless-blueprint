import { createLambdaRouter, lambdaRoute } from '@shared/middleware';
import { loginSchema, registerSchema, confirmSignUpSchema } from './handlers/shared/types';
import { loginHandler, registerHandler, confirmSignUpHandler } from './handlers/auth';

/**
 * Create auth service router using new middleware
 */
export const handler = createLambdaRouter([
  lambdaRoute({
    method: 'POST',
    path: '/auth/login',
    handler: loginHandler,
    schema: { body: loginSchema }
  }),
  lambdaRoute({
    method: 'POST',
    path: '/auth/register', 
    handler: registerHandler,
    schema: { body: registerSchema }
  }),
  lambdaRoute({
    method: 'POST',
    path: '/auth/confirm-signup',
    handler: confirmSignUpHandler,
    schema: { body: confirmSignUpSchema }
  })
]);
