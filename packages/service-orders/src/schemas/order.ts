import { z } from 'zod';

/**
 * Order Item Schema - Individual items in an order
 */
export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  price: z.number().positive().multipleOf(0.01), // 2 decimal places
  quantity: z.number().int().positive().max(1000),
  subtotal: z.number().positive().multipleOf(0.01),
});

/**
 * Shipping Address Schema
 */
export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(50),
  zipCode: z.string().min(5).max(10),
  country: z.string().length(2), // ISO 2-letter country code
});

/**
 * Payment Information Schema
 */
export const PaymentInfoSchema = z.object({
  method: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
  lastFourDigits: z.string().optional(), // For cards
  paymentId: z.string(), // External payment processor ID
  amount: z.number().positive().multipleOf(0.01),
});

/**
 * Order Status Schema
 */
export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

/**
 * Create Order Request Schema
 */
export const CreateOrderRequestSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(50),
  shippingAddress: ShippingAddressSchema,
  paymentInfo: PaymentInfoSchema,
  notes: z.string().max(500).optional(),
});

/**
 * Order Response Schema (what gets stored in DynamoDB)
 */
export const OrderSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string(), // Cognito sub
  status: OrderStatusSchema,
  items: z.array(OrderItemSchema),
  shippingAddress: ShippingAddressSchema,
  paymentInfo: PaymentInfoSchema,
  notes: z.string().optional(),
  total: z.number().positive().multipleOf(0.01),
  itemCount: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Order Path Parameters Schema
 */
export const OrderPathParamsSchema = z.object({
  orderId: z.string().uuid(),
});

// Type exports for TypeScript inference
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;
export type PaymentInfo = z.infer<typeof PaymentInfoSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderPathParams = z.infer<typeof OrderPathParamsSchema>;
