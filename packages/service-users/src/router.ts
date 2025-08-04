import { createRouter, route } from '@shared/core';
import { getUserProfileHandler } from './handlers';
/**
 * Create users service router using new middleware
 */
export const handler = createRouter([
  route({
    method: 'GET',
    path: '/users/profile',
    handler: getUserProfileHandler,
  }),
]);
