import { createLogger, AWSClients, EventBridgeClient, PutEventsCommand } from '@shared/core';
import { z } from 'zod';
import { Order, OrderStatus } from '../schemas';

const logger = createLogger('order-events');

/**
 * Order Event Schemas for EventBridge
 */
export const OrderCreatedEventSchema = z.object({
  eventType: z.literal('ORDER_CREATED'),
  orderId: z.string().uuid(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  data: z.object({
    total: z.number().positive(),
    itemCount: z.number().int().positive(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
    status: z.literal('PENDING'),
    shippingAddress: z.object({
      city: z.string(),
      state: z.string(),
      country: z.string(),
    }),
  }),
});

export const OrderStatusChangedEventSchema = z.object({
  eventType: z.literal('ORDER_STATUS_CHANGED'),
  orderId: z.string().uuid(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  data: z.object({
    previousStatus: z.string(),
    newStatus: z.string(),
    updatedBy: z.string(),
    notes: z.string().optional(),
  }),
});

export const OrderCancelledEventSchema = z.object({
  eventType: z.literal('ORDER_CANCELLED'),
  orderId: z.string().uuid(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  data: z.object({
    reason: z.string(),
    refundAmount: z.number().positive().optional(),
    cancelledBy: z.string(),
  }),
});

// Type exports
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>;
export type OrderStatusChangedEvent = z.infer<typeof OrderStatusChangedEventSchema>;
export type OrderCancelledEvent = z.infer<typeof OrderCancelledEventSchema>;

export type OrderEvent = OrderCreatedEvent | OrderStatusChangedEvent | OrderCancelledEvent;

/**
 * Order Event Publisher Service
 */
export class OrderEventPublisher {
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly eventBusName: string;
  private readonly source: string;

  constructor(
    eventBridgeClient: EventBridgeClient,
    eventBusName: string,
    source = 'orders-service'
  ) {
    this.eventBridgeClient = eventBridgeClient;
    this.eventBusName = eventBusName;
    this.source = source;
  }

  /**
   * Publish ORDER_CREATED event
   */
  async publishOrderCreated(order: Order): Promise<void> {
    const event: OrderCreatedEvent = {
      eventType: 'ORDER_CREATED',
      orderId: order.orderId,
      userId: order.userId,
      timestamp: new Date().toISOString(),
      data: {
        total: order.total,
        itemCount: order.itemCount,
        items: order.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
        status: 'PENDING',
        shippingAddress: {
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: order.shippingAddress.country,
        },
      },
    };

    await this.publishEvent(event, 'ORDER_CREATED');
  }

  /**
   * Publish ORDER_STATUS_CHANGED event
   */
  async publishOrderStatusChanged(
    orderId: string,
    userId: string,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const event: OrderStatusChangedEvent = {
      eventType: 'ORDER_STATUS_CHANGED',
      orderId,
      userId,
      timestamp: new Date().toISOString(),
      data: {
        previousStatus,
        newStatus,
        updatedBy,
        notes,
      },
    };

    await this.publishEvent(event, 'ORDER_STATUS_CHANGED');
  }

  /**
   * Publish ORDER_CANCELLED event
   */
  async publishOrderCancelled(
    orderId: string,
    userId: string,
    reason: string,
    cancelledBy: string,
    refundAmount?: number
  ): Promise<void> {
    const event: OrderCancelledEvent = {
      eventType: 'ORDER_CANCELLED',
      orderId,
      userId,
      timestamp: new Date().toISOString(),
      data: {
        reason,
        refundAmount,
        cancelledBy,
      },
    };

    await this.publishEvent(event, 'ORDER_CANCELLED');
  }

  /**
   * Generic event publishing with error handling and retry logic
   */
  private async publishEvent(event: OrderEvent, detailType: string): Promise<void> {
    try {
      // Validate event schema
      this.validateEvent(event);

      const putEventsCommand = new PutEventsCommand({
        Entries: [
          {
            Source: this.source,
            DetailType: detailType,
            Detail: JSON.stringify(event),
            EventBusName: this.eventBusName,
            Time: new Date(),
          },
        ],
      });

      const response = await this.eventBridgeClient.send(putEventsCommand);

      // Check for failed entries
      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const failedEntries = response.Entries?.filter(entry => entry.ErrorCode);
        logger.error('Failed to publish some events', {
          failedEntries,
          eventType: event.eventType,
          orderId: event.orderId,
        });
        throw new Error('Failed to publish event');
      }

      logger.info('Event published successfully', {
        eventType: event.eventType,
        orderId: event.orderId,
        userId: event.userId,
        detailType,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        error,
        eventType: event.eventType,
        orderId: event.orderId,
      });

      // In production, you might want to store failed events in DLQ
      // or implement retry logic with exponential backoff
      throw new Error(`Failed to publish ${event.eventType} event`);
    }
  }

  /**
   * Validate event against appropriate schema
   */
  private validateEvent(event: OrderEvent): void {
    try {
      switch (event.eventType) {
        case 'ORDER_CREATED':
          OrderCreatedEventSchema.parse(event);
          break;
        case 'ORDER_STATUS_CHANGED':
          OrderStatusChangedEventSchema.parse(event);
          break;
        case 'ORDER_CANCELLED':
          OrderCancelledEventSchema.parse(event);
          break;
        default:
          throw new Error(`Unknown event type: ${(event as any).eventType}`);
      }
    } catch (error) {
      logger.error('Event validation failed', { error, event });
      throw new Error('Invalid event format');
    }
  }
}

/**
 * Factory function to create OrderEventPublisher instance with singleton client
 */
export const createOrderEventPublisher = (): OrderEventPublisher => {
  const eventBusName = process.env.EVENT_BUS_NAME || 'default';

  return new OrderEventPublisher(AWSClients.eventBridge, eventBusName);
};
