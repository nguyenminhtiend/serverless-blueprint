import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger, Logger } from '@shared/core';
import { createPublicApiHandler, MiddlewareStackOptions } from './common';

// Types for route handling
export type RouteHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
export type RouteKey = `${RouteMethod} ${string}`;

export interface RouteDefinition {
  method: RouteMethod;
  path: string;
  handler: RouteHandler;
}

export interface Routes {
  [key: RouteKey]: RouteHandler;
}

export interface RouterConfig {
  serviceName: string;
  serviceVersion?: string;
  basePath?: string;
  enableHealthCheck?: boolean;
  enableCorsOptions?: boolean;
  corsOrigins?: string[];
}

export interface HealthCheckResponse {
  success: boolean;
  service: string;
  version: string;
  timestamp: string;
  routes: string[];
  environment: string;
  basePath?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  requestId?: string;
  availableRoutes?: string[];
}

/**
 * Common response headers for API responses
 */
export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Create a standardized error response for routing
 */
export function createRouterErrorResponse(
  error: string,
  code: string,
  statusCode: number = HTTP_STATUS.BAD_REQUEST,
  requestId?: string,
  additionalData?: Record<string, any>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      code,
      ...(requestId && { requestId }),
      ...additionalData,
    } as ErrorResponse),
  };
}

/**
 * Create a standardized success response for routing
 */
export function createRouterSuccessResponse<T = any>(
  data: T,
  statusCode: number = HTTP_STATUS.OK,
  message?: string,
  additionalHeaders?: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      ...COMMON_HEADERS,
      ...additionalHeaders,
    },
    body: JSON.stringify({
      success: true,
      data,
      ...(message && { message }),
    }),
  };
}

/**
 * Create a health check handler
 */
export function createHealthCheckHandler(config: RouterConfig): RouteHandler {
  return async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const healthData: HealthCheckResponse = {
      success: true,
      service: config.serviceName,
      version: config.serviceVersion || '1.0.0',
      timestamp: new Date().toISOString(),
      routes: [], // Will be populated by router
      environment: process.env.NODE_ENV || 'development',
      ...(config.basePath && { basePath: config.basePath }),
    };

    return createRouterSuccessResponse(healthData);
  };
}

/**
 * Create a CORS options handler
 */
export function createCorsOptionsHandler(allowedMethods: string[] = []): RouteHandler {
  return async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Requested-With',
        'Access-Control-Allow-Methods':
          allowedMethods.length > 0
            ? allowedMethods.join(',')
            : 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
      body: JSON.stringify({
        success: true,
        message: 'CORS preflight response',
        allowedMethods:
          allowedMethods.length > 0
            ? allowedMethods
            : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      }),
    };
  };
}

/**
 * Extract route key from event
 */
export function getRouteKey(event: APIGatewayProxyEvent): RouteKey {
  return `${event.httpMethod as RouteMethod} ${event.path}`;
}

/**
 * Extract request ID from event
 */
export function getRequestId(event: APIGatewayProxyEvent): string {
  return event.requestContext.requestId;
}

/**
 * Generic router class
 */
export class ApiRouter {
  private routes: Routes = {};
  private logger: Logger;
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = {
      enableHealthCheck: true,
      enableCorsOptions: true,
      corsOrigins: ['*'],
      ...config,
    };
    this.logger = createLogger(`${config.serviceName}-router`);

    // Auto-register health check if enabled
    if (this.config.enableHealthCheck) {
      this.addHealthCheck();
    }
  }

  /**
   * Add a route handler
   */
  addRoute(method: RouteMethod, path: string, handler: RouteHandler): void {
    const routeKey: RouteKey = `${method} ${path}`;
    this.routes[routeKey] = handler;
    this.logger.debug('Route registered', { method, path, routeKey });
  }

  /**
   * Add multiple routes from definitions
   */
  addRoutes(routeDefinitions: RouteDefinition[]): void {
    routeDefinitions.forEach(({ method, path, handler }) => {
      this.addRoute(method, path, handler);
    });
  }

  /**
   * Add routes from a routes object
   */
  addRoutesFromObject(routes: Routes): void {
    Object.entries(routes).forEach(([routeKey, handler]) => {
      this.routes[routeKey as RouteKey] = handler;
    });
  }

  /**
   * Get all registered routes
   */
  getRoutes(): string[] {
    return Object.keys(this.routes);
  }

  /**
   * Add health check endpoint
   */
  private addHealthCheck(): void {
    const healthHandler = createHealthCheckHandler(this.config);
    const healthPath = this.config.basePath ? `${this.config.basePath}/health` : '/health';
    this.addRoute('GET', healthPath, async event => {
      const response = await healthHandler(event);
      // Update routes in health check response
      const body = JSON.parse(response.body);
      body.data.routes = this.getRoutes();
      return {
        ...response,
        body: JSON.stringify(body),
      };
    });
  }

  /**
   * Handle OPTIONS requests for CORS
   */
  private async handleCorsOptions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const allowedMethods = this.getRoutes()
      .map(route => route.split(' ')[0])
      .filter((method, index, self) => self.indexOf(method) === index);

    const handler = createCorsOptionsHandler(allowedMethods);
    return await handler(event);
  }

  /**
   * Main routing handler
   */
  async route(event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> {
    const { httpMethod, path } = event;
    const routeKey = getRouteKey(event);
    const requestId = getRequestId(event);

    this.logger.info('Routing request', {
      method: httpMethod,
      path,
      routeKey,
      requestId,
    });

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS' && this.config.enableCorsOptions) {
      return await this.handleCorsOptions(event);
    }

    // Check if route exists
    const handler = this.routes[routeKey];

    if (!handler) {
      this.logger.warn('Route not found', {
        routeKey,
        availableRoutes: this.getRoutes(),
        requestId,
      });

      return createRouterErrorResponse(
        'Route not found',
        'ROUTE_NOT_FOUND',
        HTTP_STATUS.NOT_FOUND,
        requestId,
        { availableRoutes: this.getRoutes() }
      );
    }

    try {
      // Call the specific handler
      const result = await handler(event);

      this.logger.info('Route handled successfully', {
        routeKey,
        statusCode: result.statusCode,
        requestId,
      });

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Route handler error', {
        routeKey,
        error: errorMessage,
        stack: errorStack,
        requestId,
      });

      return createRouterErrorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        requestId
      );
    }
  }
}

/**
 * Create a router with middleware
 */
export function createRouter(
  config: RouterConfig,
  middlewareOptions: Partial<MiddlewareStackOptions> = {}
) {
  const router = new ApiRouter(config);

  // Create the main handler with middleware
  const routerHandler = async (event: APIGatewayProxyEvent, context: Context) => {
    return await router.route(event, context);
  };

  // Apply middleware stack
  const handler = createPublicApiHandler(routerHandler, {
    logging: { serviceName: config.serviceName },
    cors: true,
    jsonBodyParser: true,
    ...middlewareOptions,
  });

  return {
    router,
    handler,
    // Convenience methods
    addRoute: (method: RouteMethod, path: string, routeHandler: RouteHandler) =>
      router.addRoute(method, path, routeHandler),
    addRoutes: (routeDefinitions: RouteDefinition[]) => router.addRoutes(routeDefinitions),
    addRoutesFromObject: (routes: Routes) => router.addRoutesFromObject(routes),
    getRoutes: () => router.getRoutes(),
  };
}

/**
 * Utility function to create route definitions
 */
export function route(method: RouteMethod, path: string, handler: RouteHandler): RouteDefinition {
  return { method, path, handler };
}

// Convenience functions for common HTTP methods
export const GET = (path: string, handler: RouteHandler): RouteDefinition =>
  route('GET', path, handler);

export const POST = (path: string, handler: RouteHandler): RouteDefinition =>
  route('POST', path, handler);

export const PUT = (path: string, handler: RouteHandler): RouteDefinition =>
  route('PUT', path, handler);

export const DELETE = (path: string, handler: RouteHandler): RouteDefinition =>
  route('DELETE', path, handler);

export const PATCH = (path: string, handler: RouteHandler): RouteDefinition =>
  route('PATCH', path, handler);
