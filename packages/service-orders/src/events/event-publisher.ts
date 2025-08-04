import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { createLogger } from '@shared/core';
import { OrderCreatedEvent, OrderEvent } from './event-schemas';

export interface EventPublishResult {
  success: boolean;
  eventId: string;
  failureCode?: string;
  failureReason?: string;
}

export interface EventPublisherConfig {
  eventBusName?: string;
  region?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * EventBridge publisher for order events
 */
export class OrderEventPublisher {
  private eventBridgeClient: EventBridgeClient;
  private logger = createLogger('order-event-publisher');
  private config: Required<EventPublisherConfig>;

  constructor(config: EventPublisherConfig = {}) {
    this.config = {
      eventBusName: config.eventBusName || process.env.EVENT_BUS_NAME || 'default',
      region: config.region || process.env.AWS_REGION || 'ap-southeast-1',
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };

    this.eventBridgeClient = new EventBridgeClient({
      region: this.config.region,
    });

    this.logger.info('OrderEventPublisher initialized', {
      eventBusName: this.config.eventBusName,
      region: this.config.region,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Publish an order event to EventBridge
   */
  async publishEvent(event: OrderEvent): Promise<EventPublishResult> {
    const startTime = Date.now();

    this.logger.info('Publishing order event', {
      eventType: event.eventType,
      eventId: event.eventId,
      orderId: event.orderId,
      userId: event.userId,
      eventBusName: this.config.eventBusName,
      region: this.config.region,
    });

    try {
      const eventEntry: PutEventsRequestEntry = {
        Source: event.source,
        DetailType: event.eventType,
        Detail: JSON.stringify(event.data),
        EventBusName: this.config.eventBusName,
        Resources: [`order:${event.orderId}`],
        Time: new Date(event.timestamp),
      };

      const result = await this.publishWithRetry(eventEntry);
      const duration = Date.now() - startTime;

      if (result.success) {
        this.logger.info('Event published successfully', {
          eventType: event.eventType,
          eventId: event.eventId,
          orderId: event.orderId,
          duration,
        });
      } else {
        this.logger.error('Event publishing failed', {
          eventType: event.eventType,
          eventId: event.eventId,
          orderId: event.orderId,
          failureCode: result.failureCode,
          failureReason: result.failureReason,
          duration,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Unexpected error publishing event', {
        eventType: event.eventType,
        eventId: event.eventId,
        orderId: event.orderId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        eventId: event.eventId,
        failureCode: 'UNEXPECTED_ERROR',
        failureReason: errorMessage,
      };
    }
  }

  /**
   * Publish ORDER_CREATED event
   */
  async publishOrderCreated(event: OrderCreatedEvent): Promise<EventPublishResult> {
    return this.publishEvent(event);
  }

  /**
   * Publish event with retry logic
   */
  private async publishWithRetry(eventEntry: PutEventsRequestEntry): Promise<EventPublishResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const command = new PutEventsCommand({
          Entries: [eventEntry],
        });

        this.logger.info('Sending event to EventBridge', {
          attempt,
          eventBusName: eventEntry.EventBusName,
          source: eventEntry.Source,
          detailType: eventEntry.DetailType,
        });

        const response = await this.eventBridgeClient.send(command);

        // Check if the event was successfully published
        if (response.Entries && response.Entries[0]) {
          const entry = response.Entries[0];

          if (entry.EventId) {
            return {
              success: true,
              eventId: entry.EventId,
            };
          } else {
            return {
              success: false,
              eventId: eventEntry.Detail ? JSON.parse(eventEntry.Detail).eventId : 'unknown',
              failureCode: entry.ErrorCode || 'UNKNOWN_ERROR',
              failureReason: entry.ErrorMessage || 'Unknown failure',
            };
          }
        }

        throw new Error('No response entries received from EventBridge');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        this.logger.warn('Event publishing attempt failed', {
          attempt,
          maxRetries: this.config.maxRetries,
          error: lastError.message,
          willRetry: attempt < this.config.maxRetries,
        });

        if (attempt < this.config.maxRetries) {
          // Calculate exponential backoff delay
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      eventId: eventEntry.Detail ? JSON.parse(eventEntry.Detail).eventId : 'unknown',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      failureReason: lastError?.message || 'Unknown error after all retries',
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get publisher health/status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    config: EventPublisherConfig;
    timestamp: string;
  }> {
    try {
      // Simple health check - verify EventBridge client is accessible
      const testCommand = new PutEventsCommand({
        Entries: [],
      });

      // This should return quickly with empty entries
      await this.eventBridgeClient.send(testCommand);

      return {
        status: 'healthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('EventPublisher health check failed', { error });

      return {
        status: 'unhealthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Default singleton instance
 */
export const defaultEventPublisher = new OrderEventPublisher();

/**
 * Convenience function to publish ORDER_CREATED event
 */
export const publishOrderCreatedEvent = async (
  event: OrderCreatedEvent
): Promise<EventPublishResult> => {
  return defaultEventPublisher.publishOrderCreated(event);
};
