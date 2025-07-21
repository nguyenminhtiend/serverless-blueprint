import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';
import { DatabaseClient } from '../client';

export interface User {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export class UserModel {
  private client = DatabaseClient.getInstance();
  private tableName = this.client.getTableName();

  async create(user: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date().toISOString();
    const userId = nanoid();
    const userData: User = {
      ...user,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.client.getClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
          GSI1PK: 'USER',
          GSI1SK: userId,
          ...userData,
        },
      })
    );

    return userData;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.client.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (!result.Item) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PK, SK, GSI1PK, GSI1SK, ...userData } = result.Item;
    return userData as User;
  }

  async findAll(limit = 20): Promise<User[]> {
    const result = await this.client.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER',
        },
        Limit: limit,
      })
    );

    return (result.Items || []).map(item => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, GSI1PK, GSI1SK, ...userData } = item;
      return userData as User;
    });
  }
}
