import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createLogger } from '@shared/core';
import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  CreateOrderRequest,
  OrderStatus,
  UpdateOrderStatusRequest,
  GetUserOrdersQuery,
} from '../schemas';

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
   * Get user orders using GSI1 (efficient pagination, latest first)
   */
  async getUserOrders(
    userId: string,
    query: GetUserOrdersQuery
  ): Promise<{ orders: Order[]; lastEvaluatedKey?: string }> {
    try {
      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: marshall({
          ':pk': `USER#${userId}`,
        }),
        ScanIndexForward: false, // Latest first (by GSI1SK timestamp)
        Limit: query.limit,
      };

      // Add status filter if provided
      if (query.status) {
        queryInput.FilterExpression = '#status = :status';
        queryInput.ExpressionAttributeNames = {
          '#status': 'status',
        };
        queryInput.ExpressionAttributeValues = {
          ...queryInput.ExpressionAttributeValues,
          ...marshall({ ':status': query.status }),
        };
      }

      // Add pagination if provided
      if (query.startKey) {
        try {
          queryInput.ExclusiveStartKey = marshall(JSON.parse(query.startKey));
        } catch {
          throw new Error('Invalid pagination key');
        }
      }

      const response = await this.dynamoClient.send(new QueryCommand(queryInput));

      const orders = response.Items?.map(item => unmarshall(item) as Order) || [];

      let lastEvaluatedKey: string | undefined;
      if (response.LastEvaluatedKey) {
        lastEvaluatedKey = JSON.stringify(unmarshall(response.LastEvaluatedKey));
      }

      logger.info('User orders retrieved successfully', {
        userId,
        orderCount: orders.length,
        hasMore: !!lastEvaluatedKey,
      });

      return { orders, lastEvaluatedKey };
    } catch (error) {
      logger.error('Failed to get user orders', { error, userId });
      throw new Error('Failed to retrieve user orders');
    }
  }

  /**
   * Update order status (single write operation)
   */
  async updateOrderStatus(
    orderId: string,
    statusUpdate: UpdateOrderStatusRequest,
    updatedBy: string
  ): Promise<Order> {
    try {
      const timestamp = new Date().toISOString();

      // First, get the current order to return updated version
      const currentOrder = await this.getOrderById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // Validate status transition (basic validation)
      if (currentOrder.status === 'CANCELLED' || currentOrder.status === 'REFUNDED') {
        throw new Error('Cannot update status of cancelled or refunded order');
      }

      const updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
      const expressionAttributeNames: Record<string, string> = {
        '#status': 'status',
      };
      const expressionAttributeValues: Record<string, any> = {
        ':status': statusUpdate.status,
        ':updatedAt': timestamp,
      };

      // Add notes if provided
      if (statusUpdate.notes) {
        expressionAttributeNames['#notes'] = 'notes';
        expressionAttributeValues[':notes'] = statusUpdate.notes;
        updateExpression.replace('SET', 'SET #notes = :notes,');
      }

      const updateItemCommand = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `ORDER#${orderId}`,
          SK: 'DETAILS',
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.dynamoClient.send(updateItemCommand);

      if (!response.Attributes) {
        throw new Error('Failed to update order status');
      }

      const updatedOrder = unmarshall(response.Attributes) as Order;

      logger.info('Order status updated successfully', {
        orderId,
        previousStatus: currentOrder.status,
        newStatus: statusUpdate.status,
        updatedBy,
      });

      return updatedOrder;
    } catch (error) {
      logger.error('Failed to update order status', {
        error,
        orderId,
        status: statusUpdate.status,
      });
      throw new Error('Failed to update order status');
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
