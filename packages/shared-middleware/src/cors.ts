import { MiddlewareObj, MiddlewareFn } from '@middy/core';
import httpCors from '@middy/http-cors';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID',
    'X-API-Key',
    'Accept',
  ],
  exposedHeaders: ['X-Correlation-ID', 'X-Response-Time', 'X-Memory-Used'],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

export const corsMiddleware = (
  options: CorsOptions = {}
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_CORS_OPTIONS, ...options };

  return httpCors({
    origin: config.origin as string,
    headers: Array.isArray(config.allowedHeaders)
      ? config.allowedHeaders.join(',')
      : config.allowedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
  });
};

export const developmentCors = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return corsMiddleware({
    origin: true, // Allow all origins in development
    credentials: true,
  });
};

export const productionCors = (
  allowedOrigins: string[]
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return corsMiddleware({
    origin: allowedOrigins,
    credentials: true,
  });
};

export const publicCors = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return corsMiddleware({
    origin: '*',
    credentials: false,
  });
};

export const customCorsMiddleware = (
  options: CorsOptions
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request: any
  ) => {
    const { event } = request;

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      const origin = event.headers?.origin || event.headers?.Origin;
      const allowedOrigin = getAllowedOrigin(origin, options.origin);

      request.response = {
        statusCode: options.optionsSuccessStatus || 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin || '*',
          'Access-Control-Allow-Methods': Array.isArray(options.methods)
            ? options.methods.join(',')
            : options.methods || 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': Array.isArray(options.allowedHeaders)
            ? options.allowedHeaders.join(',')
            : options.allowedHeaders || 'Content-Type,Authorization',
          'Access-Control-Max-Age': (options.maxAge || 86400).toString(),
          ...(options.credentials && { 'Access-Control-Allow-Credentials': 'true' }),
        },
        body: '',
      };
      return;
    }
  };

  const after: MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: any) => {
    const { event, response } = request;

    if (!response) return;

    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigin = getAllowedOrigin(origin, options.origin);

    // Add CORS headers to response
    response.headers = response.headers || {};

    if (allowedOrigin) {
      response.headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }

    if (options.credentials) {
      response.headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (options.exposedHeaders) {
      response.headers['Access-Control-Expose-Headers'] = Array.isArray(options.exposedHeaders)
        ? options.exposedHeaders.join(',')
        : options.exposedHeaders;
    }
  };

  return {
    before,
    after,
  };
};

// Environment-based CORS configuration
export const getEnvironmentCors = (): MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> => {
  const environment = process.env.ENVIRONMENT || 'development';

  switch (environment) {
    case 'production': {
      const prodOrigins = process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com'];
      return productionCors(prodOrigins);
    }

    case 'staging': {
      const stagingOrigins = process.env.CORS_ORIGIN?.split(',') || [
        'https://staging.yourdomain.com',
        'https://yourdomain.com',
      ];
      return productionCors(stagingOrigins);
    }

    case 'development':
    default:
      return developmentCors();
  }
};

// Helper functions
const getAllowedOrigin = (
  requestOrigin: string | undefined,
  allowedOrigins: string | string[] | boolean | undefined
): string | null => {
  if (!requestOrigin) {
    return '*';
  }

  if (allowedOrigins === true) {
    return requestOrigin;
  }

  if (allowedOrigins === false) {
    return null;
  }

  if (typeof allowedOrigins === 'string') {
    if (allowedOrigins === '*') {
      return '*';
    }
    return allowedOrigins === requestOrigin ? requestOrigin : null;
  }

  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
  }

  return '*';
};

// Security-focused CORS for APIs
export const apiCors = (
  trustedOrigins: string[] = []
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  return corsMiddleware({
    origin: trustedOrigins.length > 0 ? trustedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID'],
    credentials: true,
    maxAge: 3600, // 1 hour for APIs
  });
};
