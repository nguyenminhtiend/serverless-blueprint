import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { AllEvents } from '@shared/types';

export class EventPublisher {
  private client: EventBridgeClient;
  private eventBusName: string;

  constructor(eventBusName?: string) {
    this.client = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.eventBusName = eventBusName || process.env.EVENT_BUS_NAME || 'default';
  }

  async publish(event: AllEvents): Promise<void> {
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

  async publishBatch(events: AllEvents[]): Promise<void> {
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

  createEvent<T extends AllEvents>(
    eventType: T['eventType'],
    source: T['source'],
    data: T['data'],
    correlationId?: string
  ): T {
    return {
      eventType,
      source,
      data,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || this.generateCorrelationId(),
    } as T;
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
