import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import type { DomainEvent } from '@shared/types';
import { createLogger } from './logger';

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
 * Centralized EventBridge publisher for all domain events
 * Provides robust error handling, retry logic, and structured logging
 */
export class EventPublisher {
  private eventBridgeClient: EventBridgeClient;
  private logger = createLogger('event-publisher');
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

    this.logger.info('EventPublisher initialized', {
      eventBusName: this.config.eventBusName,
      region: this.config.region,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Publish a single domain event to EventBridge
   */
  async publish(event: DomainEvent): Promise<EventPublishResult> {
    const startTime = Date.now();

    this.logger.info('Publishing domain event', {
      eventType: event.eventType,
      eventId: event.eventId,
      source: event.source,
      correlationId: event.correlationId,
    });

    try {
      const eventEntry: PutEventsRequestEntry = {
        Source: event.source,
        DetailType: event.eventType,
        Detail: JSON.stringify(event),
        EventBusName: this.config.eventBusName,
        Resources: (event.data as any).orderId
          ? [`order:${(event.data as any).orderId}`]
          : (event.data as any).userId
            ? [`user:${(event.data as any).userId}`]
            : [],
        Time: new Date(event.timestamp),
      };

      const result = await this.publishWithRetry(eventEntry);
      const duration = Date.now() - startTime;

      if (result.success) {
        this.logger.info('Event published successfully', {
          eventType: event.eventType,
          eventId: event.eventId,
          source: event.source,
          correlationId: event.correlationId,
          duration,
        });
      } else {
        this.logger.error('Event publishing failed', {
          eventType: event.eventType,
          eventId: event.eventId,
          source: event.source,
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
        source: event.source,
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
   * Publish multiple domain events as a batch
   */
  async publishBatch(events: DomainEvent[]): Promise<EventPublishResult[]> {
    const startTime = Date.now();

    this.logger.info('Publishing event batch', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map(e => e.eventType))],
    });

    const results: EventPublishResult[] = [];

    try {
      const entries: PutEventsRequestEntry[] = events.map(event => ({
        Source: event.source,
        DetailType: event.eventType,
        Detail: JSON.stringify(event),
        EventBusName: this.config.eventBusName,
        Resources: (event.data as any).orderId
          ? [`order:${(event.data as any).orderId}`]
          : (event.data as any).userId
            ? [`user:${(event.data as any).userId}`]
            : [],
        Time: new Date(event.timestamp),
      }));

      const command = new PutEventsCommand({ Entries: entries });
      const response = await this.eventBridgeClient.send(command);

      if (response.Entries) {
        response.Entries.forEach((entry, index) => {
          const event = events[index];
          if (entry.EventId) {
            results.push({
              success: true,
              eventId: entry.EventId,
            });
          } else {
            results.push({
              success: false,
              eventId: event.eventId,
              failureCode: entry.ErrorCode || 'UNKNOWN_ERROR',
              failureReason: entry.ErrorMessage || 'Unknown failure',
            });
          }
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.info('Batch publish completed', {
        totalEvents: events.length,
        successCount,
        failureCount,
        duration: Date.now() - startTime,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Batch publish failed', {
        eventCount: events.length,
        error: errorMessage,
        duration,
      });

      // Return failure results for all events
      return events.map(event => ({
        success: false,
        eventId: event.eventId,
        failureCode: 'BATCH_PUBLISH_ERROR',
        failureReason: errorMessage,
      }));
    }
  }

  /**
   * Create a domain event with default values
   */
  createEvent<T extends DomainEvent>(
    eventType: T['eventType'],
    source: T['source'],
    data: T['data'],
    options?: {
      correlationId?: string;
      eventId?: string;
      metadata?: Record<string, unknown>;
    }
  ): T {
    const eventId = options?.eventId || globalThis.crypto.randomUUID();
    const timestamp = new Date().toISOString();

    return {
      eventId,
      eventType,
      eventVersion: '1.0',
      source,
      timestamp,
      correlationId: options?.correlationId,
      metadata: options?.metadata,
      data,
    } as T;
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

        const response = await this.eventBridgeClient.send(command);

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
      const testCommand = new PutEventsCommand({
        Entries: [],
      });

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
export const defaultEventPublisher = new EventPublisher();

/**
 * Convenience functions for common operations
 */
export const publishEvent = async (event: DomainEvent): Promise<EventPublishResult> => {
  return defaultEventPublisher.publish(event);
};

export const publishEvents = async (events: DomainEvent[]): Promise<EventPublishResult[]> => {
  return defaultEventPublisher.publishBatch(events);
};

export const createDomainEvent = <T extends DomainEvent>(
  eventType: T['eventType'],
  source: T['source'],
  data: T['data'],
  options?: {
    correlationId?: string;
    eventId?: string;
    metadata?: Record<string, unknown>;
  }
): T => {
  return defaultEventPublisher.createEvent(eventType, source, data, options);
};
