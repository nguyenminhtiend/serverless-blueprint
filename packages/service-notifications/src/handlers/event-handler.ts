import { createLogger } from '@shared/core';
import { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { z } from 'zod';
import { NotificationService } from '../services/notification-service';
import { NotificationRequest } from '../types/notification';

/**
 * SQS message wrapper schema for EventBridge events
 */
const SQSEventBridgeMessageSchema = z.object({
  version: z.string(),
  id: z.string(),
  'detail-type': z.string(),
  source: z.string(),
  account: z.string(),
  time: z.string(),
  region: z.string(),
  detail: z.record(z.unknown()), // The actual domain event
});

/**
 * Common event data structure
 */
interface BaseEventData {
  userId: string;
  orderId?: string;
}

interface OrderEventData extends BaseEventData {
  orderId: string;
  total: number;
  items?: any[];
  itemCount?: number;
}

interface OrderStatusEventData extends OrderEventData {
  previousStatus: string;
  newStatus: string;
  reason?: string;
}

interface OrderCancelledEventData extends OrderEventData {
  reason: string;
  refundAmount?: number;
}

interface PaymentEventData extends BaseEventData {
  orderId: string;
  paymentId: string;
  status: string;
  amount: number;
  method: string;
}

interface UserEventData extends BaseEventData {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Event-driven notification handler
 * Processes domain events from SQS queues and triggers appropriate notifications
 */
export class EventHandler {
  private notificationService: NotificationService;
  private logger = createLogger('notification-event-handler');

  constructor() {
    // Initialize notification service with configuration from environment
    const mockMode = process.env.ENABLE_MOCK_NOTIFICATIONS === 'true';

    this.notificationService = new NotificationService({
      email: {
        fromAddress: process.env.FROM_EMAIL_ADDRESS || 'noreply@example.com',
        replyToAddresses: process.env.REPLY_TO_ADDRESSES?.split(','),
        mockMode,
      },
      sms: {
        senderId: process.env.SMS_SENDER_ID,
        mockMode,
      },
    });

    this.logger.info('EventHandler initialized', {
      mockMode,
      environment: process.env.NODE_ENV,
    });
  }

  /**
   * Main SQS event handler
   */
  async handleSQSEvent(event: SQSEvent, context: Context): Promise<void> {
    this.logger.info('Processing SQS event batch', {
      recordCount: event.Records.length,
      requestId: context.awsRequestId,
    });

    const results = await Promise.allSettled(
      event.Records.map(record => this.processSQSRecord(record))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    this.logger.info('SQS event batch processed', {
      total: event.Records.length,
      successCount,
      failureCount,
      requestId: context.awsRequestId,
    });

    // If any records failed, log details (but don't throw - let SQS handle retries)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const record = event.Records[index];
        this.logger.error('Failed to process SQS record', {
          messageId: record.messageId,
          error: result.reason,
          body: record.body,
        });
      }
    });
  }

  /**
   * Process individual SQS record
   */
  private async processSQSRecord(record: SQSRecord): Promise<void> {
    this.logger.info('Processing SQS record', {
      messageId: record.messageId,
      eventSource: record.eventSource,
    });

    try {
      // Parse EventBridge message from SQS
      const eventBridgeMessage = JSON.parse(record.body);
      const validatedMessage = SQSEventBridgeMessageSchema.parse(eventBridgeMessage);

      // Extract domain event from EventBridge detail
      const domainEvent = validatedMessage.detail;

      // Use detail-type from EventBridge wrapper as eventType
      const eventType = validatedMessage['detail-type'];

      this.logger.info('Processing domain event', {
        eventType: eventType,
        eventId: (domainEvent as any).eventId || 'unknown',
        source: validatedMessage.source,
        messageId: record.messageId,
        eventData: JSON.stringify(domainEvent),
      });

      // Route event to appropriate handler using EventBridge detail-type
      await this.routeDomainEventByType(eventType, domainEvent);

      this.logger.info('Domain event processed successfully', {
        eventType: eventType,
        eventId: (domainEvent as any).eventId || 'unknown',
        messageId: record.messageId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to process SQS record', {
        messageId: record.messageId,
        error: errorMessage,
        body: record.body,
      });

      // Re-throw to trigger SQS retry mechanism
      throw error;
    }
  }

  /**
   * Normalize event data format (handles both direct events and wrapped events)
   */
  private normalizeEventData<T>(eventData: T | { data: T }): T {
    return 'data' in (eventData as any) ? (eventData as { data: T }).data : (eventData as T);
  }

  /**
   * Route domain event to appropriate notification handler
   */
  private async routeDomainEventByType(eventType: string, eventData: any): Promise<void> {
    switch (eventType) {
      case 'ORDER_CREATED':
        await this.handleOrderCreated(eventData);
        break;

      case 'ORDER_STATUS_CHANGED':
        await this.handleOrderStatusChanged(eventData);
        break;

      case 'ORDER_CANCELLED':
        await this.handleOrderCancelled(eventData);
        break;

      case 'PAYMENT_PROCESSED':
        await this.handlePaymentProcessed(eventData);
        break;

      case 'USER_CREATED':
        await this.handleUserCreated(eventData);
        break;

      default:
        this.logger.warn('Unhandled event type', {
          eventType: eventType,
          eventData: JSON.stringify(eventData),
        });
    }
  }


  /**
   * Handle ORDER_CREATED event
   */
  private async handleOrderCreated(eventData: OrderEventData | { data: OrderEventData }): Promise<void> {
    const data = this.normalizeEventData(eventData);
    
    this.logger.info('Handling ORDER_CREATED event', {
      orderId: data.orderId,
      userId: data.userId,
    });

    // Create notification requests for the order creation
    const notifications: NotificationRequest[] = [
      // Email confirmation
      {
        userId: data.userId,
        type: 'ORDER_CREATED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(data.userId),
        template: 'order-created',
        subject: `Order Confirmation - #${data.orderId}`,
        payload: {
          orderId: data.orderId,
          total: data.total,
          itemCount: data.itemCount || data.items?.length || 0,
          items: data.items || [],
        },
        priority: 'HIGH',
      },
      // SMS confirmation (if user has phone number)
      {
        userId: data.userId,
        type: 'ORDER_CREATED',
        channel: 'SMS',
        recipient: await this.getUserPhone(data.userId),
        template: 'order-created',
        payload: {
          orderId: data.orderId,
          total: data.total,
        },
        priority: 'MEDIUM',
      },
    ];

    // Filter out notifications where recipient is not available
    const validNotifications = notifications.filter(n => n.recipient);

    if (validNotifications.length > 0) {
      await this.notificationService.processBatchNotifications(validNotifications);
    }
  }


  /**
   * Handle ORDER_STATUS_CHANGED event
   */
  private async handleOrderStatusChanged(eventData: OrderStatusEventData | { data: OrderStatusEventData }): Promise<void> {
    const data = this.normalizeEventData(eventData);
    
    this.logger.info('Handling ORDER_STATUS_CHANGED event', {
      orderId: data.orderId,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: data.userId,
        type: 'ORDER_STATUS_CHANGED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(data.userId),
        template: 'order-status-changed',
        subject: `Order Update - #${data.orderId}`,
        payload: {
          orderId: data.orderId,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          reason: data.reason,
          trackingUrl: `https://example.com/track/${data.orderId}`,
        },
        priority: 'MEDIUM',
      },
    ];

    const validNotifications = notifications.filter(n => n.recipient);
    if (validNotifications.length > 0) {
      await this.notificationService.processBatchNotifications(validNotifications);
    }
  }

  /**
   * Handle ORDER_CANCELLED event
   */
  private async handleOrderCancelled(eventData: OrderCancelledEventData | { data: OrderCancelledEventData }): Promise<void> {
    const data = this.normalizeEventData(eventData);
    
    this.logger.info('Handling ORDER_CANCELLED event', {
      orderId: data.orderId,
      reason: data.reason,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: data.userId,
        type: 'ORDER_CANCELLED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(data.userId),
        template: 'order-cancelled',
        subject: `Order Cancelled - #${data.orderId}`,
        payload: {
          orderId: data.orderId,
          reason: data.reason,
          refundAmount: data.refundAmount,
        },
        priority: 'HIGH',
      },
    ];

    const validNotifications = notifications.filter(n => n.recipient);
    if (validNotifications.length > 0) {
      await this.notificationService.processBatchNotifications(validNotifications);
    }
  }

  /**
   * Handle PAYMENT_PROCESSED event
   */
  private async handlePaymentProcessed(eventData: PaymentEventData | { data: PaymentEventData }): Promise<void> {
    const data = this.normalizeEventData(eventData);
    
    this.logger.info('Handling PAYMENT_PROCESSED event', {
      orderId: data.orderId,
      paymentId: data.paymentId,
      status: data.status,
    });

    if (data.status === 'SUCCESS') {
      const notifications: NotificationRequest[] = [
        {
          userId: data.userId,
          type: 'PAYMENT_PROCESSED',
          channel: 'EMAIL',
          recipient: await this.getUserEmail(data.userId),
          template: 'payment-processed',
          subject: `Payment Confirmation - #${data.orderId}`,
          payload: {
            orderId: data.orderId,
            paymentId: data.paymentId,
            amount: data.amount,
            method: data.method,
          },
          priority: 'HIGH',
        },
      ];

      const validNotifications = notifications.filter(n => n.recipient);
      if (validNotifications.length > 0) {
        await this.notificationService.processBatchNotifications(validNotifications);
      }
    }
  }

  /**
   * Handle USER_CREATED event
   */
  private async handleUserCreated(eventData: UserEventData | { data: UserEventData }): Promise<void> {
    const data = this.normalizeEventData(eventData);
    
    this.logger.info('Handling USER_CREATED event', {
      userId: data.userId,
      email: data.email,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: data.userId,
        type: 'USER_WELCOME',
        channel: 'EMAIL',
        recipient: data.email,
        template: 'user-welcome',
        subject: 'Welcome to Our Service!',
        payload: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
        },
        priority: 'MEDIUM',
      },
    ];

    await this.notificationService.processBatchNotifications(notifications);
  }

  /**
   * Get user email address (placeholder - would query user service/database)
   */
  private async getUserEmail(_userId: string): Promise<string> {
    // In a real implementation, this would query the user service or database
    // For now, return a placeholder
    return process.env.DEFAULT_USER_EMAIL || 'user@example.com';
  }

  /**
   * Get user phone number (placeholder - would query user service/database)
   */
  private async getUserPhone(_userId: string): Promise<string> {
    // In a real implementation, this would query the user service or database
    // For now, return a placeholder if SMS is enabled
    return process.env.DEFAULT_USER_PHONE || '';
  }
}

// Export handler instance for Lambda
const eventHandler = new EventHandler();

/**
 * Lambda handler for SQS events from EventBridge
 */
export const handleNotificationEvents = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  return eventHandler.handleSQSEvent(event, context);
};
