import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { z } from 'zod';
import { createLogger } from '@shared/core';
import {
  DomainEvent,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
  PaymentProcessedEvent,
  UserCreatedEvent,
} from '@shared/types';
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

type SQSEventBridgeMessage = z.infer<typeof SQSEventBridgeMessageSchema>;

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
      const domainEvent = validatedMessage.detail as unknown as DomainEvent;

      this.logger.info('Processing domain event', {
        eventType: domainEvent.eventType,
        eventId: domainEvent.eventId,
        source: domainEvent.source,
        messageId: record.messageId,
      });

      // Route event to appropriate handler
      await this.routeDomainEvent(domainEvent);

      this.logger.info('Domain event processed successfully', {
        eventType: domainEvent.eventType,
        eventId: domainEvent.eventId,
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
   * Route domain event to appropriate notification handler
   */
  private async routeDomainEvent(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'ORDER_CREATED':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;

      case 'ORDER_STATUS_CHANGED':
        await this.handleOrderStatusChanged(event as OrderStatusChangedEvent);
        break;

      case 'ORDER_CANCELLED':
        await this.handleOrderCancelled(event as OrderCancelledEvent);
        break;

      case 'PAYMENT_PROCESSED':
        await this.handlePaymentProcessed(event as PaymentProcessedEvent);
        break;

      case 'USER_CREATED':
        await this.handleUserCreated(event as UserCreatedEvent);
        break;

      default:
        this.logger.warn('Unhandled event type', {
          eventType: event.eventType,
          eventId: event.eventId,
        });
    }
  }

  /**
   * Handle ORDER_CREATED event
   */
  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.info('Handling ORDER_CREATED event', {
      orderId: event.data.orderId,
      userId: event.data.userId,
    });

    // Create notification requests for the order creation
    const notifications: NotificationRequest[] = [
      // Email confirmation
      {
        userId: event.data.userId,
        type: 'ORDER_CREATED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(event.data.userId),
        template: 'order-created',
        subject: `Order Confirmation - #${event.data.orderId}`,
        payload: {
          orderId: event.data.orderId,
          total: event.data.total,
          itemCount: event.data.items.length,
          items: event.data.items,
        },
        priority: 'HIGH',
      },
      // SMS confirmation (if user has phone number)
      {
        userId: event.data.userId,
        type: 'ORDER_CREATED',
        channel: 'SMS',
        recipient: await this.getUserPhone(event.data.userId),
        template: 'order-created',
        payload: {
          orderId: event.data.orderId,
          total: event.data.total,
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
  private async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    this.logger.info('Handling ORDER_STATUS_CHANGED event', {
      orderId: event.data.orderId,
      previousStatus: event.data.previousStatus,
      newStatus: event.data.newStatus,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: event.data.userId,
        type: 'ORDER_STATUS_CHANGED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(event.data.userId),
        template: 'order-status-changed',
        subject: `Order Update - #${event.data.orderId}`,
        payload: {
          orderId: event.data.orderId,
          previousStatus: event.data.previousStatus,
          newStatus: event.data.newStatus,
          reason: event.data.reason,
          trackingUrl: `https://example.com/track/${event.data.orderId}`,
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
  private async handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    this.logger.info('Handling ORDER_CANCELLED event', {
      orderId: event.data.orderId,
      reason: event.data.reason,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: event.data.userId,
        type: 'ORDER_CANCELLED',
        channel: 'EMAIL',
        recipient: await this.getUserEmail(event.data.userId),
        template: 'order-cancelled',
        subject: `Order Cancelled - #${event.data.orderId}`,
        payload: {
          orderId: event.data.orderId,
          reason: event.data.reason,
          refundAmount: event.data.refundAmount,
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
  private async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    this.logger.info('Handling PAYMENT_PROCESSED event', {
      orderId: event.data.orderId,
      paymentId: event.data.paymentId,
      status: event.data.status,
    });

    if (event.data.status === 'SUCCESS') {
      const notifications: NotificationRequest[] = [
        {
          userId: event.data.userId,
          type: 'PAYMENT_PROCESSED',
          channel: 'EMAIL',
          recipient: await this.getUserEmail(event.data.userId),
          template: 'payment-processed',
          subject: `Payment Confirmation - #${event.data.orderId}`,
          payload: {
            orderId: event.data.orderId,
            paymentId: event.data.paymentId,
            amount: event.data.amount,
            method: event.data.method,
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
  private async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    this.logger.info('Handling USER_CREATED event', {
      userId: event.data.userId,
      email: event.data.email,
    });

    const notifications: NotificationRequest[] = [
      {
        userId: event.data.userId,
        type: 'USER_WELCOME',
        channel: 'EMAIL',
        recipient: event.data.email,
        template: 'user-welcome',
        subject: 'Welcome to Our Service!',
        payload: {
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          email: event.data.email,
        },
        priority: 'MEDIUM',
      },
    ];

    await this.notificationService.processBatchNotifications(notifications);
  }

  /**
   * Get user email address (placeholder - would query user service/database)
   */
  private async getUserEmail(userId: string): Promise<string> {
    // In a real implementation, this would query the user service or database
    // For now, return a placeholder
    return process.env.DEFAULT_USER_EMAIL || 'user@example.com';
  }

  /**
   * Get user phone number (placeholder - would query user service/database)
   */
  private async getUserPhone(userId: string): Promise<string> {
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
