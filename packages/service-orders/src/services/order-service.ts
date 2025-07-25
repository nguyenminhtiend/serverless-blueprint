import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createLogger } from '@shared/core';
import { v4 as uuidv4 } from 'uuid';
import { CreateOrderRequest, Order, OrderStatus } from '../schemas';

const logger = createLogger('order-service');

export class OrderService {
  private readonly dynamoClient: DynamoDBClient;
  private readonly tableName: string;

  constructor(dynamoClient: DynamoDBClient, tableName: string) {
    this.dynamoClient = dynamoClient;
    this.tableName = tableName;
  }

  /**
   * Create a new order with normalized single-table design
   * - Single write operation to ORDER#{orderId}#DETAILS
   * - GSI1 projection for user access: USER#{userId}#ORDER#{timestamp}#{orderId}
   */
  async createOrder(userId: string, orderData: CreateOrderRequest): Promise<Order> {
    const orderId = uuidv4();
    const timestamp = new Date().toISOString();

    // Calculate totals
    const itemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
    const total = orderData.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Validate payment amount matches calculated total
    if (Math.abs(orderData.paymentInfo.amount - total) > 0.01) {
      throw new Error('Payment amount does not match order total');
    }

    const order: Order = {
      orderId,
      userId,
      status: 'PENDING' as OrderStatus,
      items: orderData.items,
      shippingAddress: orderData.shippingAddress,
      paymentInfo: orderData.paymentInfo,
      notes: orderData.notes,
      total,
      itemCount,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      // Single write operation with GSI projection
      const putItemCommand = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `ORDER#${orderId}`,
          SK: 'DETAILS',
          GSI1PK: `USER#${userId}`,
          GSI1SK: `ORDER#${timestamp}#${orderId}`,
          ...order,
        }),
        ConditionExpression: 'attribute_not_exists(PK)',
      });

      await this.dynamoClient.send(putItemCommand);

      logger.info('Order created successfully', {
        orderId,
        userId,
        total,
        itemCount,
      });

      return order;
    } catch (error) {
      logger.error('Failed to create order', { error, orderId, userId });
      throw new Error('Failed to create order');
    }
  }

  /**
   * Get order details by order ID (direct access)
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const getItemCommand = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `ORDER#${orderId}`,
          SK: 'DETAILS',
        }),
      });

      const response = await this.dynamoClient.send(getItemCommand);

      if (!response.Item) {
        logger.warn('Order not found', { orderId });
        return null;
      }

      const orderData = unmarshall(response.Item);
      logger.info('Order retrieved successfully', { orderId });

      return orderData as Order;
    } catch (error) {
      logger.error('Failed to get order', { error, orderId });
      throw new Error('Failed to retrieve order');
    }
  }

  /**
   * Validate order ownership (security check)
   */
  async validateOrderOwnership(orderId: string, userId: string): Promise<boolean> {
    try {
      const order = await this.getOrderById(orderId);
      return order?.userId === userId;
    } catch (error) {
      logger.error('Failed to validate order ownership', { error, orderId, userId });
      return false;
    }
  }
}

/**
 * Factory function to create OrderService instance
 */
export const createOrderService = (): OrderService => {
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is required');
  }

  return new OrderService(dynamoClient, tableName);
};
