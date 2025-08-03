import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '@shared/core';
import { createHmac } from 'crypto';

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

export function addSecretHashIfNeeded(params: any, email: string): void {
  const secretHash = calculateSecretHash(email);
  if (secretHash) {
    params.SecretHash = secretHash;
  }
}
