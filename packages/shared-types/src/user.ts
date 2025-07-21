import { AuditFields, UUID, Email, Status } from './common';
import { DynamoDBItem, UserKey } from './database';

// User entity
export interface User extends AuditFields {
  id: UUID;
  email: Email;
  firstName: string;
  lastName: string;
  status: Status;
  roles: UserRole[];
  preferences?: UserPreferences;
  profile?: UserProfile;
}

// User roles
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MANAGER = 'MANAGER',
}

// User preferences
export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
}

// Extended user profile
export interface UserProfile {
  avatarUrl?: string;
  bio?: string;
  phoneNumber?: string;
  address?: Address;
  dateOfBirth?: string;
  occupation?: string;
}

// Address type
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// DynamoDB representation
export interface UserDynamoItem extends DynamoDBItem {
  PK: UserKey;
  SK: 'PROFILE';
  GSI1PK: 'USER_EMAIL';
  GSI1SK: Email;
  entityType: 'USER';
  data: User;
}

// User creation/update DTOs
export interface CreateUserRequest {
  email: Email;
  firstName: string;
  lastName: string;
  password: string;
  roles?: UserRole[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  status?: Status;
  roles?: UserRole[];
  preferences?: Partial<UserPreferences>;
  profile?: Partial<UserProfile>;
}

// User query types
export interface GetUserByIdRequest {
  userId: UUID;
}

export interface GetUserByEmailRequest {
  email: Email;
}

export interface ListUsersRequest {
  status?: Status;
  role?: UserRole;
  limit?: number;
  cursor?: string;
}
