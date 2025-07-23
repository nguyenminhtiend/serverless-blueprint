import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '@shared/core';
import { createRouterErrorResponse, HTTP_STATUS, parseValidatedBody } from '@shared/middleware';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { createHmac } from 'crypto';
import { z } from 'zod';

export const CLIENT_ID = process.env.CLIENT_ID!;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';

export const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
export const logger = createLogger('auth-service');

export function calculateSecretHash(email: string): string {
  if (!CLIENT_SECRET) return '';

  const message = email + CLIENT_ID;
  const hmac = createHmac('SHA256', CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest('base64');
}

export function parseRequestBody<T>(event: APIGatewayProxyEvent, schema: z.ZodType<T>): T {
  // Use centralized body parsing - body should already be parsed by middleware
  return parseValidatedBody(event, schema);
}

export function addSecretHashIfNeeded(params: any, email: string): void {
  const secretHash = calculateSecretHash(email);
  if (secretHash) {
    params.SecretHash = secretHash;
  }
}

export function getStatusCodeFromCognitoError(errorName: string): number {
  switch (errorName) {
    case 'NotAuthorizedException':
    case 'UserNotConfirmedException':
      return HTTP_STATUS.UNAUTHORIZED;
    case 'UserNotFoundException':
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return HTTP_STATUS.BAD_REQUEST;
    default:
      return HTTP_STATUS.BAD_REQUEST;
  }
}

export function handleCognitoError(error: Error & { name?: string }, operation: string) {
  logger.error(`${operation} failed`, { error: error.message, errorName: error.name });
  const statusCode = getStatusCodeFromCognitoError(error.name || '');
  return createRouterErrorResponse(
    error.message || `${operation} failed`,
    error.name || `${operation.toUpperCase()}_ERROR`,
    statusCode
  );
}
