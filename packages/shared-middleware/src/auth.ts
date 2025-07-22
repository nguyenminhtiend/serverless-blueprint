import * as middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '@shared/core';
import type { JwtPayload, AuthContext } from '@shared/types';

// Extended interface for middleware
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthMiddlewareOptions {
  secret?: string;
  issuer?: string;
  audience?: string;
  skipPaths?: string[];
  optional?: boolean;
}

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  user?: AuthenticatedUser;
  jwt?: JwtPayload;
}

export interface AuthMiddlewareRequest {
  event: AuthenticatedEvent;
  context: Context;
  response?: APIGatewayProxyResult;
  error?: Error;
  internal: Record<string, any>;
}

const DEFAULT_OPTIONS: Partial<AuthMiddlewareOptions> = {
  secret: process.env.JWT_SECRET,
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  skipPaths: [],
  optional: false,
};

export const authMiddleware = (options: AuthMiddlewareOptions = {}): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: AuthMiddlewareRequest) => {
    const { event } = request as AuthMiddlewareRequest;
    
    // Skip authentication for certain paths
    if (config.skipPaths?.some(path => event.path.match(new RegExp(path)))) {
      return;
    }

    // Extract token from Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      if (config.optional) {
        return;
      }
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/, '');
    if (!token) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    try {
      // Verify JWT token
      if (!config.secret) {
        throw new Error('JWT secret not configured');
      }

      const decoded = jwt.verify(token, config.secret, {
        issuer: config.issuer,
        audience: config.audience,
      }) as JwtPayload;

      // Attach user info to event
      event.user = {
        id: decoded.sub || decoded.userId || '',
        email: decoded.email || '',
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
      };
      
      event.jwt = decoded;

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new UnauthorizedError('Token not active');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  };

  return {
    before,
  };
};

export const requireRole = (requiredRoles: string | string[]): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: AuthMiddlewareRequest) => {
    const { event } = request as AuthMiddlewareRequest;
    
    if (!event.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRoles = event.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenError(`Required role(s): ${roles.join(', ')}`);
    }
  };

  return {
    before,
  };
};

export const requirePermission = (requiredPermissions: string | string[]): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request: AuthMiddlewareRequest) => {
    const { event } = request as AuthMiddlewareRequest;
    
    if (!event.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPermissions = event.user.permissions || [];
    const hasRequiredPermission = permissions.some(permission => userPermissions.includes(permission));

    if (!hasRequiredPermission) {
      throw new ForbiddenError(`Required permission(s): ${permissions.join(', ')}`);
    }
  };

  return {
    before,
  };
};

export const extractUserId = (event: AuthenticatedEvent): string => {
  if (!event.user?.id) {
    throw new UnauthorizedError('User ID not available');
  }
  return event.user.id;
};

export const generateJWT = (payload: Omit<JwtPayload, 'iat' | 'exp'>, options?: { expiresIn?: string }): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  return jwt.sign(payload, secret, {
    expiresIn: options?.expiresIn || '24h',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  } as jwt.SignOptions);
};