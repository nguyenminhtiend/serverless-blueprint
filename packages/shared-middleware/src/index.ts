// Core middleware exports
export * from './auth';
export * from './authorizer';
export * from './common';
export * from './error-handler';
export * from './logging';
export * from './router';
export * from './validation';

// New lightweight middleware (without middy) - with namespace to avoid conflicts
export {
  createRouter as createLambdaRouter,
  route as lambdaRoute,
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
  HttpError,
  LambdaContext,
  ParsedEvent,
  Handler,
  RouteSchema,
  Route
} from './middleware';

// Export zod for convenience
export { z } from 'zod';
