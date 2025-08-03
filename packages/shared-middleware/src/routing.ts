import { ZodError, ZodType } from 'zod';
import { Route, APIGatewayProxyEventV2WithJWTAuthorizer } from './types';
import { HttpError } from './errors';

export const parseBody = (event: APIGatewayProxyEventV2WithJWTAuthorizer): any => {
  if (!event.body) return {};

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (contentType.includes('application/json')) {
      return JSON.parse(body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(body));
    }
    return body;
  } catch {
    throw new HttpError(400, 'Invalid request body format');
  }
};

export const validateSchema = (data: any, schema: ZodType, fieldName: string): any => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, `Validation failed for ${fieldName}`, error.issues);
    }
    throw error;
  }
};

export const matchPath = (
  pattern: string,
  path: string
): { match: boolean; params: Record<string, string> } => {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
};

export const findMatchingRoute = (
  routes: Route[],
  method: string,
  path: string
): { route: Route; params: Record<string, string> } | null => {
  for (const route of routes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) {
      continue;
    }

    const { match, params } = matchPath(route.path, path);
    if (match) {
      return { route, params };
    }
  }

  return null;
};

export const route = ({
  method,
  path,
  handler,
  schema,
}: {
  method: string;
  path: string;
  handler: Route['handler'];
  schema?: Route['schema'];
}): Route => ({
  method,
  path,
  handler,
  schema,
});