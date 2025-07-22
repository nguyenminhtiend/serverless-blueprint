import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { DomainEvent } from '@shared/types';

export class EventPublisher {
  private client: EventBridgeClient;
  private eventBusName: string;

  constructor(eventBusName?: string) {
    this.client = new EventBridgeClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
    });
    this.eventBusName = eventBusName || process.env.EVENT_BUS_NAME || 'default';
  }

  async publish(event: DomainEvent): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: event.source,
          DetailType: event.eventType,
          Detail: JSON.stringify(event.data),
          EventBusName: this.eventBusName,
          Time: new Date(event.timestamp),
        },
      ],
    });

    try {
      const result = await this.client.send(command);

      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        throw new Error(`Failed to publish event: ${JSON.stringify(result.Entries)}`);
      }

      console.log('Event published successfully:', {
        eventType: event.eventType,
        source: event.source,
        correlationId: event.correlationId,
      });
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    const entries = events.map(event => ({
      Source: event.source,
      DetailType: event.eventType,
      Detail: JSON.stringify(event.data),
      EventBusName: this.eventBusName,
      Time: new Date(event.timestamp),
    }));

    const command = new PutEventsCommand({ Entries: entries });

    try {
      const result = await this.client.send(command);

      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        throw new Error(`Failed to publish ${result.FailedEntryCount} events`);
      }

      console.log(`Published ${events.length} events successfully`);
    } catch (error) {
      console.error('Failed to publish events:', error);
      throw error;
    }
  }

  createEvent<T extends DomainEvent>(
    eventType: T['eventType'],
    source: T['source'],
    data: T['data'],
    correlationId?: string
  ): T {
    return {
      eventId: this.generateEventId(),
      eventType,
      eventVersion: '1.0',
      source,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || this.generateCorrelationId(),
      data,
    } as T;
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
