import { createRouter, route } from '@shared/core';
import { confirmSignUpHandler, loginHandler, registerHandler } from './handlers/auth';
import { confirmSignUpSchema, loginSchema, registerSchema } from './handlers/shared/types';

/**
 * Create auth service router using new middleware
 */
export const handler = createRouter([
  route({
    method: 'POST',
    path: '/auth/login',
    handler: loginHandler,
    schema: { body: loginSchema },
  }),
  route({
    method: 'POST',
    path: '/auth/register',
    handler: registerHandler,
    schema: { body: registerSchema },
  }),
  route({
    method: 'POST',
    path: '/auth/confirm-signup',
    handler: confirmSignUpHandler,
    schema: { body: confirmSignUpSchema },
  }),
]);
