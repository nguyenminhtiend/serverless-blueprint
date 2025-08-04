import { createLogger } from './logger';
import { APIGatewayProxyResultV2, Context } from 'aws-lambda';
import {
  HttpError,
  createErrorResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  ParsedEvent,
  Route,
} from './types';
import { createSuccessResponse } from './responses';
import { findMatchingRoute, parseBody, validateSchema } from './routing';

const logger = createLogger('middleware');

const addContext = (context: Context): void => {
  if (process.env.ENABLE_REQUEST_LOGGING === 'false') return;
  logger.addContext(context);
};

const logRequest = (event: APIGatewayProxyEventV2WithJWTAuthorizer | ParsedEvent) => {
  if (process.env.ENABLE_REQUEST_LOGGING === 'false') return;

  const userId = event.requestContext.authorizer?.jwt?.claims?.sub;
  const logData = {
    requestId: event.requestContext.requestId,
    method: event.requestContext.http.method,
    path: event.requestContext.http.path,
    userId: typeof userId === 'string' ? userId : undefined,
  };

  logger.info('Incoming request', logData);
};

const logResponse = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer | ParsedEvent,
  response: APIGatewayProxyResultV2,
  duration: number
) => {
  if (process.env.ENABLE_REQUEST_LOGGING === 'false') return;

  const statusCode =
    typeof response === 'object' && 'statusCode' in response ? response.statusCode : 200;

  const logData = {
    requestId: event.requestContext.requestId,
    statusCode,
    duration: `${duration}ms`,
  };

  const logLevel =
    statusCode && statusCode >= 500 ? 'error' : statusCode && statusCode >= 400 ? 'warn' : 'info';

  logger[logLevel]('Request completed', logData);
};

export const createRouter = (routes: Route[]) => {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    const startTime = Date.now();

    addContext(context);
    logRequest(event);

    try {
      const method = event.requestContext.http.method;
      const path = event.requestContext.http.path;

      const matchedRoute = findMatchingRoute(routes, method, path);
      if (!matchedRoute) {
        throw new HttpError(404, `Route not found: ${method} ${path}`);
      }

      const { route, params } = matchedRoute;

      const parsedEvent: ParsedEvent = {
        ...event,
        body: parseBody(event),
        pathParameters: { ...(event.pathParameters || {}), ...params } as Record<string, string>,
        queryStringParameters: event.queryStringParameters
          ? ({ ...event.queryStringParameters } as Record<string, string>)
          : {},
      };

      if (route.schema?.body) {
        parsedEvent.body = validateSchema(parsedEvent.body, route.schema.body, 'body');
      }
      if (route.schema?.query) {
        parsedEvent.queryStringParameters = validateSchema(
          parsedEvent.queryStringParameters,
          route.schema.query,
          'query parameters'
        );
      }
      if (route.schema?.path) {
        parsedEvent.pathParameters = validateSchema(
          parsedEvent.pathParameters,
          route.schema.path,
          'path parameters'
        );
      }

      const result = await route.handler({
        event: parsedEvent,
        context,
      });

      const response = createSuccessResponse(result);
      const duration = Date.now() - startTime;
      logResponse(event, response, duration);

      return response;
    } catch (error) {
      const response = createErrorResponse(error);
      const duration = Date.now() - startTime;
      logResponse(event, response, duration);

      return response;
    }
  };
};
