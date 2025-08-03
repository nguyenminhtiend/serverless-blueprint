// Re-export error handling from shared-core
export {
  HttpError,
  createErrorResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError
} from '@shared/core';