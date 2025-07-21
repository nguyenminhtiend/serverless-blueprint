import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export class DatabaseClient {
  private static instance: DatabaseClient;
  private client: DynamoDBDocumentClient;
  private tableName: string;

  private constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    this.tableName = process.env.TABLE_NAME || 'ServerlessTable';
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  public getClient(): DynamoDBDocumentClient {
    return this.client;
  }

  public getTableName(): string {
    return this.tableName;
  }
}
