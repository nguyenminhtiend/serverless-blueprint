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
  detail: z.record(z.string(), z.unknown()), // The actual domain event
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
  private async handleOrderCreated(
    eventData: OrderEventData | { data: OrderEventData }
  ): Promise<void> {
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
