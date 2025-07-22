import {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { createLogger } from '@shared/core';
import type { JwtPayload } from '@shared/types';

const logger = createLogger('jwt-authorizer');

export interface AuthorizerConfig {
  jwtSecret: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  allowUnauthenticated?: boolean;
}

const getConfig = (): AuthorizerConfig => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    jwtSecret,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    allowUnauthenticated: process.env.ALLOW_UNAUTHENTICATED === 'true',
  };
};

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerResult> => {
  const correlationId = event.headers?.['x-correlation-id'] || `auth-${Date.now()}`;

  logger.info('JWT Authorizer invoked', {
    correlationId,
    requestId: event.requestContext?.requestId,
    path: event.rawPath,
    method: event.requestContext?.http?.method,
  });

  try {
    const config = getConfig();
    const authorizationToken = event.headers?.authorization || event.headers?.Authorization;

    if (!authorizationToken) {
      if (config.allowUnauthenticated) {
        logger.info('No authorization token provided, allowing unauthenticated access', {
          correlationId,
        });
        return { isAuthorized: true };
      }

      logger.warn('No authorization token provided', { correlationId });
      return { isAuthorized: false };
    }

    // Extract Bearer token
    const token = authorizationToken.replace(/^Bearer\s+/i, '');
    if (!token || token === authorizationToken) {
      logger.warn('Invalid authorization header format', { correlationId });
      return { isAuthorized: false };
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }) as JwtPayload;

    logger.info('JWT token verified successfully', {
      correlationId,
      userId: decoded.sub || decoded.userId,
      roles: decoded.roles,
    });

    return {
      isAuthorized: true,
    };
  } catch (error) {
    logger.error(
      'JWT authorization failed',
      { correlationId, error: (error as Error).message },
      error as Error
    );

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { correlationId, error: error.message });
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired', { correlationId, error: error.message });
    } else if (error instanceof jwt.NotBeforeError) {
      logger.warn('JWT token not active yet', { correlationId, error: error.message });
    }

    return { isAuthorized: false };
  }
};

// Lambda authorizer for policy-based authorization (alternative implementation)
export const policyHandler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewayAuthorizerResult> => {
  const correlationId = event.headers?.['x-correlation-id'] || `auth-policy-${Date.now()}`;

  logger.info('Policy-based JWT Authorizer invoked', {
    correlationId,
    requestId: event.requestContext?.requestId,
    path: event.rawPath,
    method: event.requestContext?.http?.method,
  });

  try {
    const config = getConfig();
    const authorizationToken = event.headers?.authorization || event.headers?.Authorization;

    if (!authorizationToken) {
      throw new Error('Unauthorized');
    }

    const token = authorizationToken.replace(/^Bearer\s+/i, '');
    if (!token || token === authorizationToken) {
      throw new Error('Invalid authorization header format');
    }

    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }) as JwtPayload;

    const principalId = decoded.sub || decoded.userId || 'unknown';
    const policy = generatePolicy(principalId, 'Allow', event.routeArn || '*');

    // Add user context
    policy.context = {
      userId: principalId,
      email: decoded.email || '',
      roles: JSON.stringify(decoded.roles || []),
      permissions: JSON.stringify(decoded.permissions || []),
      correlationId,
    };

    logger.info('Policy-based authorization successful', {
      correlationId,
      userId: principalId,
      roles: decoded.roles,
    });

    return policy;
  } catch (error) {
    logger.error('Policy-based authorization failed', { correlationId }, error as Error);
    throw new Error('Unauthorized');
  }
};

// Helper function to generate IAM policy
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
};
