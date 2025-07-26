import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createLogger } from '@shared/core';
import { Address, ExtendedUserProfile } from '../schemas';

const logger = createLogger('user-profile-service');

// Extended address type with storage-specific fields
interface StoredAddress extends Address {
  id: string;
  label: string;
  isDefault: boolean;
}

// Payment method type based on schema
interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'paypal';
  label: string;
  lastFour: string;
  isDefault: boolean;
}

export interface UserProfileRecord {
  PK: string; // USER#{cognitoSub}
  SK: string; // PROFILE
  preferences?: Record<string, unknown>;
  addresses?: StoredAddress[];
  paymentMethods?: PaymentMethod[];
  businessRole: 'customer' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export class UserProfileService {
  private client: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string, region: string = 'us-east-1') {
    this.tableName = tableName;
    this.client = new DynamoDBClient({
      region,
      maxAttempts: 3,
    });
  }

  /**
   * Get user's extended profile from DynamoDB
   */
  async getUserProfile(cognitoSub: string): Promise<ExtendedUserProfile | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${cognitoSub}`,
          SK: 'PROFILE',
        }),
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        logger.info('No extended profile found for user', { cognitoSub });
        return null;
      }

      const item = unmarshall(response.Item) as UserProfileRecord;

      return {
        preferences: item.preferences,
        addresses: item.addresses || [],
        paymentMethods: item.paymentMethods || [],
        businessRole: item.businessRole,
      };
    } catch (error) {
      logger.error('Failed to get user profile', { cognitoSub, error });
      throw new Error('Failed to retrieve user profile');
    }
  }

}

// Default export for convenience
export const createUserProfileService = (
  tableName?: string,
  region?: string
): UserProfileService => {
  const table = tableName || process.env.TABLE_NAME;
  if (!table) {
    throw new Error('DynamoDB table name is required');
  }
  return new UserProfileService(table, region);
};
