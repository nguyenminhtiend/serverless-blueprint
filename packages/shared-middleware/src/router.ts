import { APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { 
  Route, 
  APIGatewayProxyEventV2WithJWTAuthorizer, 
  ParsedEvent 
} from './types';
import { HttpError, createErrorResponse } from './errors';
import { parseBody, validateSchema, findMatchingRoute } from './routing';
import { createSuccessResponse } from './responses';

export const createRouter = (routes: Route[]) => {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    context: Context
  ): Promise<APIGatewayProxyResultV2> => {
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

      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
};