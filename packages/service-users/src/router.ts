import { createRouter, route } from '@shared/core';
import { getUserProfileHandler } from './handlers';
import { userIdPathSchema, userProfileSchema } from './schemas';

/**
 * Create users service router using new middleware
 */
export const handler = createRouter([
  route({
    method: 'GET',
    path: '/users/profile',
    handler: getUserProfileHandler,
  }),
  route({
    method: 'GET',
    path: '/users/{userId}',
    handler: getUserProfileHandler,
    schema: {
      path: userIdPathSchema,
    },
  }),
  route({
    method: 'PUT',
    path: '/users/profile',
    handler: getUserProfileHandler,
    schema: {
      body: userProfileSchema,
    },
  }),
]);
