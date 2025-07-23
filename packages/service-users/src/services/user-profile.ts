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

  /**
   * Create or update user's extended profile
   */
  async updateUserProfile(
    cognitoSub: string,
    profile: Partial<ExtendedUserProfile>
  ): Promise<ExtendedUserProfile> {
    try {
      const now = new Date().toISOString();
      const existingProfile = await this.getUserProfile(cognitoSub);

      const updatedProfile: UserProfileRecord = {
        PK: `USER#${cognitoSub}`,
        SK: 'PROFILE',
        preferences: profile.preferences || existingProfile?.preferences || undefined,
        addresses: profile.addresses ?? existingProfile?.addresses ?? [],
        paymentMethods: profile.paymentMethods ?? existingProfile?.paymentMethods ?? [],
        businessRole: profile.businessRole || existingProfile?.businessRole || 'customer',
        createdAt: existingProfile ? (existingProfile as any).createdAt || now : now,
        updatedAt: now,
      };

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(updatedProfile),
      });

      await this.client.send(command);

      logger.info('User profile updated successfully', { cognitoSub });

      return {
        preferences: updatedProfile.preferences || undefined,
        addresses: updatedProfile.addresses || [],
        paymentMethods: updatedProfile.paymentMethods || [],
        businessRole: updatedProfile.businessRole,
      };
    } catch (error) {
      logger.error('Failed to update user profile', { cognitoSub, error });
      throw new Error('Failed to update user profile');
    }
  }

  /**
   * Add new address to user's profile
   */
  async addAddress(
    cognitoSub: string,
    address: Address,
    label: string,
    isDefault: boolean = false
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(cognitoSub);
      const addresses = profile?.addresses || [];

      // If this is set as default, unset all other defaults
      if (isDefault) {
        addresses.forEach((addr: StoredAddress) => (addr.isDefault = false));
      }

      const newAddress = {
        id: globalThis.crypto.randomUUID(),
        ...address,
        label,
        isDefault,
      };

      addresses.push(newAddress);

      await this.updateUserProfile(cognitoSub, { addresses });

      logger.info('Address added successfully', { cognitoSub, addressId: newAddress.id });
    } catch (error) {
      logger.error('Failed to add address', { cognitoSub, error });
      throw new Error('Failed to add address');
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    cognitoSub: string,
    addressId: string,
    updates: Partial<Address & { label?: string; isDefault?: boolean }>
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(cognitoSub);
      const addresses = profile?.addresses || [];

      const addressIndex = addresses.findIndex((addr: StoredAddress) => addr.id === addressId);
      if (addressIndex === -1) {
        throw new Error('Address not found');
      }

      // If setting as default, unset all other defaults
      if (updates.isDefault) {
        addresses.forEach((addr: StoredAddress) => (addr.isDefault = false));
      }

      addresses[addressIndex] = { ...addresses[addressIndex], ...updates };

      await this.updateUserProfile(cognitoSub, { addresses });

      logger.info('Address updated successfully', { cognitoSub, addressId });
    } catch (error) {
      logger.error('Failed to update address', { cognitoSub, addressId, error });
      throw new Error('Failed to update address');
    }
  }

  /**
   * Remove an address from user's profile
   */
  async removeAddress(cognitoSub: string, addressId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(cognitoSub);
      const addresses = profile?.addresses || [];

      const filteredAddresses = addresses.filter((addr: StoredAddress) => addr.id !== addressId);

      if (filteredAddresses.length === addresses.length) {
        throw new Error('Address not found');
      }

      await this.updateUserProfile(cognitoSub, { addresses: filteredAddresses });

      logger.info('Address removed successfully', { cognitoSub, addressId });
    } catch (error) {
      logger.error('Failed to remove address', { cognitoSub, addressId, error });
      throw new Error('Failed to remove address');
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
