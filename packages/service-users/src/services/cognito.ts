import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminGetUserCommand,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '@shared/core';

const logger = createLogger('cognito-service');

export interface CognitoUser {
  cognitoSub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  enabled: boolean;
  status: string;
  attributes: Record<string, string>;
}

export class CognitoService {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor(userPoolId: string, region: string = 'ap-southeast-1') {
    this.userPoolId = userPoolId;
    this.client = new CognitoIdentityProviderClient({
      region,
      maxAttempts: 3,
    });
  }

  /**
   * Get user profile from Cognito using access token
   */
  async getUserByAccessToken(accessToken: string): Promise<CognitoUser> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      if (!response.UserAttributes) {
        throw new Error('No user attributes found');
      }

      return this.parseUserAttributes(response.UserAttributes, response.Username!);
    } catch (error) {
      logger.error('Failed to get user by access token', { error });
      throw new Error('Failed to retrieve user profile from Cognito');
    }
  }

  /**
   * Get user profile from Cognito using username (admin operation)
   */
  async getUserByUsername(username: string): Promise<CognitoUser> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      const response = await this.client.send(command);

      if (!response.UserAttributes) {
        throw new Error('No user attributes found');
      }

      return this.parseUserAttributes(
        response.UserAttributes,
        response.Username!,
        response.Enabled,
        response.UserStatus
      );
    } catch (error) {
      logger.error('Failed to get user by username', { username, error });
      throw new Error('Failed to retrieve user profile from Cognito');
    }
  }

  /**
   * Extract Cognito Sub from JWT token payload
   */
  extractCognitoSubFromToken(tokenPayload: any): string {
    if (!tokenPayload.sub) {
      throw new Error('Missing Cognito Sub in token payload');
    }
    return tokenPayload.sub;
  }

  /**
   * Parse Cognito user attributes into structured format
   */
  private parseUserAttributes(
    attributes: AttributeType[],
    username: string,
    enabled: boolean = true,
    status: string = 'CONFIRMED'
  ): CognitoUser {
    const attributeMap = attributes.reduce(
      (acc, attr) => {
        if (attr.Name && attr.Value) {
          acc[attr.Name] = attr.Value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    return {
      cognitoSub: attributeMap.sub || username,
      email: attributeMap.email || '',
      firstName: attributeMap.given_name,
      lastName: attributeMap.family_name,
      emailVerified: attributeMap.email_verified === 'true',
      enabled,
      status,
      attributes: attributeMap,
    };
  }

  /**
   * Validate that a Cognito Sub follows the expected format
   */
  validateCognitoSub(cognitoSub: string): boolean {
    // Cognito Sub is typically a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(cognitoSub);
  }
}

// Default export for convenience
export const createCognitoService = (userPoolId?: string, region?: string): CognitoService => {
  const poolId = userPoolId || process.env.COGNITO_USER_POOL_ID;
  if (!poolId) {
    throw new Error('Cognito User Pool ID is required');
  }
  return new CognitoService(poolId, region);
};
