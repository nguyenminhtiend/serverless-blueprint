import { AuditFields, UUID } from './common';

// DynamoDB single-table design types
export interface DynamoDBItem extends AuditFields {
  PK: string; // Partition Key
  SK: string; // Sort Key
  GSI1PK?: string; // Global Secondary Index 1 Partition Key
  GSI1SK?: string; // Global Secondary Index 1 Sort Key
  GSI2PK?: string; // Global Secondary Index 2 Partition Key
  GSI2SK?: string; // Global Secondary Index 2 Sort Key
  entityType: string;
  ttl?: number;
}

// Entity key patterns
export type UserKey = `USER#${UUID}`;
export type OrderKey = `ORDER#${UUID}`;
export type ProductKey = `PRODUCT#${UUID}`;

// Sort key patterns
export type ProfileSK = 'PROFILE';
export type DetailsSK = 'DETAILS';
export type OrderItemSK = `ORDER#${UUID}`;

// GSI access patterns
export interface UsersByEmailGSI {
  GSI1PK: 'USER_EMAIL';
  GSI1SK: string; // email
}

export interface OrdersByStatusGSI {
  GSI1PK: 'ORDER_STATUS';
  GSI1SK: string; // status
}

export interface ProductsByCategoryGSI {
  GSI1PK: 'PRODUCT_CATEGORY';
  GSI1SK: string; // category
}

// Query parameters
export interface QueryParams {
  PK: string;
  SK?: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  scanIndexForward?: boolean;
}

// DynamoDB operations result
export interface DynamoDBResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
  count: number;
  scannedCount?: number;
}
