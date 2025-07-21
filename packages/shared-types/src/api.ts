import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Enhanced API Gateway types
export interface ApiGatewayEvent extends APIGatewayProxyEvent {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export interface ApiGatewayContext extends Context {
  requestId: string;
}

export type ApiHandler = (
  event: ApiGatewayEvent,
  context: ApiGatewayContext
) => Promise<APIGatewayProxyResult>;

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

// Standard HTTP status codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

// CORS configuration
export interface CorsConfig {
  origin: string | string[];
  methods: HttpMethod[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
