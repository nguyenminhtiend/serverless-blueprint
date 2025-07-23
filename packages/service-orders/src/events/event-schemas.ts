import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Order Item Schema
 */
export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  price: z.number().positive('Price must be positive'),
  totalPrice: z.number().positive('Total price must be positive'),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * Order Status Enum Schema
 */
export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * Base Event Schema - Common fields for all events
 */
export const BaseEventSchema = z.object({
  eventId: z.string().uuid('Event ID must be a valid UUID'),
  eventType: z.string().min(1, 'Event type is required'),
  source: z.string().default('orders-service'),
  timestamp: z.string().datetime('Timestamp must be a valid ISO datetime string'),
  version: z.string().default('1.0'),
  correlationId: z.string().optional(),
});

/**
 * ORDER_CREATED Event Schema
 */
export const OrderCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('ORDER_CREATED'),
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  userId: z.string().min(1, 'User ID is required'),
  data: z.object({
    orderId: z.string().uuid(),
    userId: z.string().min(1),
    status: z.literal('PENDING'),
    total: z.number().positive('Total must be positive'),
    itemCount: z.number().int().positive('Item count must be positive'),
    items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
    shipping: z.object({
      address: z.string().min(1, 'Shipping address is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      zipCode: z.string().min(1, 'Zip code is required'),
      country: z.string().default('US'),
    }),
    payment: z.object({
      method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER']),
      currency: z.string().default('USD'),
    }),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>;

/**
 * Event Types Union
 */
export type OrderEvent = OrderCreatedEvent;

/**
 * Event Type Constants
 */
export const EVENT_TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
} as const;

/**
 * Event validation utilities
 */
export const validateOrderCreatedEvent = (data: unknown): OrderCreatedEvent => {
  return OrderCreatedEventSchema.parse(data);
};

/**
 * Event factory functions
 */
export const createOrderCreatedEvent = (
  orderId: string,
  userId: string,
  orderData: OrderCreatedEvent['data'],
  options?: {
    correlationId?: string;
    eventId?: string;
  }
): OrderCreatedEvent => {
  const eventId = options?.eventId || randomUUID();
  const timestamp = new Date().toISOString();

  const event: OrderCreatedEvent = {
    eventId,
    eventType: EVENT_TYPES.ORDER_CREATED,
    source: 'orders-service',
    timestamp,
    version: '1.0',
    orderId,
    userId,
    data: orderData,
    ...(options?.correlationId && { correlationId: options.correlationId }),
  };

  // Validate the event before returning
  return validateOrderCreatedEvent(event);
};
