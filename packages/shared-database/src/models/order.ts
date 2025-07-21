import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';
import { DatabaseClient } from '../client';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';
  createdAt: string;
  updatedAt: string;
}

export class OrderModel {
  private client = DatabaseClient.getInstance();
  private tableName = this.client.getTableName();

  async create(order: Omit<Order, 'orderId' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const now = new Date().toISOString();
    const orderId = nanoid();
    const orderData: Order = {
      ...order,
      orderId,
      createdAt: now,
      updatedAt: now,
    };

    await this.client.getClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `ORDER#${orderId}`,
          SK: 'DETAILS',
          GSI1PK: 'STATUS',
          GSI1SK: order.status,
          ...orderData,
        },
      })
    );

    // Also create user-order relationship
    await this.client.getClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${order.userId}`,
          SK: `ORDER#${orderId}`,
          GSI1PK: 'ORDER',
          GSI1SK: orderId,
          orderId: orderId,
          status: order.status,
          total: order.total,
          createdAt: now,
        },
      })
    );

    return orderData;
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.client.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `ORDER#${orderId}`,
          SK: 'DETAILS',
        },
      })
    );

    if (!result.Item) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PK, SK, GSI1PK, GSI1SK, ...orderData } = result.Item;
    return orderData as Order;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const result = await this.client.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'ORDER#',
        },
      })
    );

    const orderIds = (result.Items || []).map(item => item.orderId);

    if (orderIds.length === 0) return [];

    // Fetch full order details
    const orders: Order[] = [];
    for (const orderId of orderIds) {
      const order = await this.findById(orderId);
      if (order) orders.push(order);
    }

    return orders;
  }

  async findByStatus(status: Order['status']): Promise<Order[]> {
    const result = await this.client.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'STATUS',
          ':sk': status,
        },
      })
    );

    return (result.Items || []).map(item => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, GSI1PK, GSI1SK, ...orderData } = item;
      return orderData as Order;
    });
  }
}
