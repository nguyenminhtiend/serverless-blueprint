import { z } from 'zod';

/**
 * Notification types and channels
 */
export const NotificationTypeSchema = z.enum([
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_CANCELLED',
  'PAYMENT_PROCESSED',
  'USER_WELCOME',
]);

export const NotificationChannelSchema = z.enum(['EMAIL', 'SMS', 'PUSH']);

export const NotificationPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

/**
 * Notification Request Schema
 */
export const NotificationRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  recipient: z.string().min(1, 'Recipient is required'),
  template: z.string().min(1, 'Template is required'),
  subject: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  priority: NotificationPrioritySchema.default('MEDIUM'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;

/**
 * Email notification specific schema
 */
export const EmailNotificationSchema = NotificationRequestSchema.extend({
  channel: z.literal('EMAIL'),
  recipient: z.string().email('Must be a valid email address'),
  subject: z.string().min(1, 'Email subject is required'),
});

export type EmailNotification = z.infer<typeof EmailNotificationSchema>;

/**
 * SMS notification specific schema
 */
export const SMSNotificationSchema = NotificationRequestSchema.extend({
  channel: z.literal('SMS'),
  recipient: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid phone number with country code'),
});

export type SMSNotification = z.infer<typeof SMSNotificationSchema>;

/**
 * Notification delivery result
 */
export const NotificationResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  deliveredAt: z.string().datetime().optional(),
});

export type NotificationResult = z.infer<typeof NotificationResultSchema>;

/**
 * Email templates configuration
 */
export const EMAIL_TEMPLATES = {
  ORDER_CREATED: {
    template: 'order-created',
    subject: 'Order Confirmation - #{orderId}',
  },
  ORDER_STATUS_CHANGED: {
    template: 'order-status-changed',
    subject: 'Order Update - #{orderId}',
  },
  ORDER_CANCELLED: {
    template: 'order-cancelled',
    subject: 'Order Cancelled - #{orderId}',
  },
  PAYMENT_PROCESSED: {
    template: 'payment-processed',
    subject: 'Payment Confirmation - #{orderId}',
  },
  USER_WELCOME: {
    template: 'user-welcome',
    subject: 'Welcome to Our Service!',
  },
} as const;

/**
 * SMS templates configuration
 */
export const SMS_TEMPLATES = {
  ORDER_CREATED:
    "Your order #{orderId} has been confirmed. Total: ${total}. We'll notify you when it ships!",
  ORDER_STATUS_CHANGED:
    'Order #{orderId} status update: {status}. Track your order at {trackingUrl}',
  ORDER_CANCELLED:
    'Order #{orderId} has been cancelled. Refund of ${refundAmount} will be processed in 3-5 business days.',
  PAYMENT_PROCESSED: 'Payment of ${amount} for order #{orderId} has been processed successfully.',
  USER_WELCOME: 'Welcome to our service! Your account has been created successfully.',
} as const;
