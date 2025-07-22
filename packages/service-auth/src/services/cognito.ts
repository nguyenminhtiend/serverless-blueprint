import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '@shared/core';

const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const USER_POOL_ID = process.env.USER_POOL_ID!;

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const logger = createLogger('cognito-service');

export interface CognitoUser {
  email: string;
  emailVerified: boolean;
  userStatus: string;
  userCreateDate?: Date;
  userLastModifiedDate?: Date;
  givenName?: string;
  familyName?: string;
  sub?: string;
}

/**
 * Get user details by access token
 */
export const getUserFromToken = async (accessToken: string): Promise<CognitoUser> => {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const result = await cognitoClient.send(command);

    const user: CognitoUser = {
      email: result.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '',
      emailVerified:
        result.UserAttributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      userStatus: 'CONFIRMED', // GetUser only works for confirmed users
      givenName: result.UserAttributes?.find(attr => attr.Name === 'given_name')?.Value,
      familyName: result.UserAttributes?.find(attr => attr.Name === 'family_name')?.Value,
      sub: result.UserAttributes?.find(attr => attr.Name === 'sub')?.Value,
    };

    logger.info('Retrieved user from token', { email: user.email });
    return user;
  } catch (error: any) {
    logger.error('Failed to get user from token', { error: error.message });
    throw error;
  }
};

/**
 * Get user details by email (admin operation)
 */
export const getUserByEmail = async (email: string): Promise<CognitoUser> => {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    });

    const result = await cognitoClient.send(command);

    const user: CognitoUser = {
      email: result.UserAttributes?.find(attr => attr.Name === 'email')?.Value || email,
      emailVerified:
        result.UserAttributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      userStatus: result.UserStatus || 'UNKNOWN',
      userCreateDate: result.UserCreateDate,
      userLastModifiedDate: result.UserLastModifiedDate,
      givenName: result.UserAttributes?.find(attr => attr.Name === 'given_name')?.Value,
      familyName: result.UserAttributes?.find(attr => attr.Name === 'family_name')?.Value,
      sub: result.UserAttributes?.find(attr => attr.Name === 'sub')?.Value,
    };

    logger.info('Retrieved user by email', { email });
    return user;
  } catch (error: any) {
    logger.error('Failed to get user by email', { email, error: error.message });
    throw error;
  }
};

/**
 * Update user attributes (admin operation)
 */
export const updateUserAttributes = async (
  email: string,
  attributes: Record<string, string>
): Promise<void> => {
  try {
    const userAttributes = Object.entries(attributes).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: userAttributes,
    });

    await cognitoClient.send(command);
    logger.info('Updated user attributes', { email, attributes: Object.keys(attributes) });
  } catch (error: any) {
    logger.error('Failed to update user attributes', { email, error: error.message });
    throw error;
  }
};

/**
 * Set user password (admin operation)
 */
export const setUserPassword = async (
  email: string,
  password: string,
  permanent: boolean = true
): Promise<void> => {
  try {
    const command = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: permanent,
    });

    await cognitoClient.send(command);
    logger.info('Set user password', { email, permanent });
  } catch (error: any) {
    logger.error('Failed to set user password', { email, error: error.message });
    throw error;
  }
};

/**
 * Delete user (admin operation)
 */
export const deleteUser = async (email: string): Promise<void> => {
  try {
    const command = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    });

    await cognitoClient.send(command);
    logger.info('Deleted user', { email });
  } catch (error: any) {
    logger.error('Failed to delete user', { email, error: error.message });
    throw error;
  }
};

/**
 * List users with optional filters (admin operation)
 */
export const listUsers = async (options?: {
  limit?: number;
  filter?: string;
  nextToken?: string;
}): Promise<{
  users: CognitoUser[];
  nextToken?: string;
}> => {
  try {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: options?.limit || 50,
      Filter: options?.filter,
      PaginationToken: options?.nextToken,
    });

    const result = await cognitoClient.send(command);

    const users: CognitoUser[] = (result.Users || []).map(user => ({
      email: user.Attributes?.find(attr => attr.Name === 'email')?.Value || '',
      emailVerified:
        user.Attributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true',
      userStatus: user.UserStatus || 'UNKNOWN',
      userCreateDate: user.UserCreateDate,
      userLastModifiedDate: user.UserLastModifiedDate,
      givenName: user.Attributes?.find(attr => attr.Name === 'given_name')?.Value,
      familyName: user.Attributes?.find(attr => attr.Name === 'family_name')?.Value,
      sub: user.Attributes?.find(attr => attr.Name === 'sub')?.Value,
    }));

    logger.info('Listed users', { count: users.length });

    return {
      users,
      nextToken: result.PaginationToken,
    };
  } catch (error: any) {
    logger.error('Failed to list users', { error: error.message });
    throw error;
  }
};
