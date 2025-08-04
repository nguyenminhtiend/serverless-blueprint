import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';

// Re-export types and utilities that services might need
export type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
export type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
export type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
export {
  GetItemCommand,
  PutItemCommand,
  type GetItemCommandInput,
  type PutItemCommandInput,
  type GetItemCommandOutput,
  type PutItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
export { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
export {
  GetUserCommand,
  AdminGetUserCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
export { PutEventsCommand, type PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';

/**
 * AWS Client Singletons
 * Ensures single client instances across Lambda warm invocations
 */
class AWSClients {
  private static _dynamoClient?: DynamoDBClient;
  private static _cognitoClient?: CognitoIdentityProviderClient;
  private static _eventBridgeClient?: EventBridgeClient;

  /**
   * Get singleton DynamoDB client
   */
  static get dynamoDB(): DynamoDBClient {
    if (!this._dynamoClient) {
      this._dynamoClient = new DynamoDBClient({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        maxAttempts: 3,
      });
    }
    return this._dynamoClient;
  }

  /**
   * Get singleton Cognito client
   */
  static get cognito(): CognitoIdentityProviderClient {
    if (!this._cognitoClient) {
      this._cognitoClient = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        maxAttempts: 3,
      });
    }
    return this._cognitoClient;
  }

  /**
   * Get singleton EventBridge client
   */
  static get eventBridge(): EventBridgeClient {
    if (!this._eventBridgeClient) {
      this._eventBridgeClient = new EventBridgeClient({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        maxAttempts: 3,
      });
    }
    return this._eventBridgeClient;
  }

  /**
   * Reset clients (useful for testing)
   */
  static reset(): void {
    this._dynamoClient = undefined;
    this._cognitoClient = undefined;
    this._eventBridgeClient = undefined;
  }
}

export { AWSClients };
