import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

/**
 * AWS Client Singletons
 * Ensures single client instances across Lambda warm invocations
 */
class AWSClients {
  private static _dynamoClient?: DynamoDBClient;
  private static _cognitoClient?: CognitoIdentityProviderClient;

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
   * Reset clients (useful for testing)
   */
  static reset(): void {
    this._dynamoClient = undefined;
    this._cognitoClient = undefined;
  }
}

export { AWSClients };