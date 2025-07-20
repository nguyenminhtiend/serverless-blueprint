import { UUID, ISO8601 } from './common'
import { User, UserRole } from './user'
import { Order, OrderStatus } from './order'

// Base event interface
export interface BaseEvent {
  eventId: UUID
  eventType: string
  eventVersion: string
  source: string
  timestamp: ISO8601
  correlationId?: UUID
  metadata?: Record<string, any>
}

// User events
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'USER_CREATED'
  data: {
    userId: UUID
    email: string
    firstName: string
    lastName: string
    roles: UserRole[]
  }
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'USER_UPDATED'
  data: {
    userId: UUID
    changes: Partial<User>
    previousValues: Partial<User>
  }
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'USER_DELETED'
  data: {
    userId: UUID
    email: string
  }
}

// Order events
export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'ORDER_CREATED'
  data: {
    orderId: UUID
    userId: UUID
    items: Array<{
      productId: UUID
      quantity: number
      unitPrice: number
    }>
    total: number
    currency: string
  }
}

export interface OrderStatusChangedEvent extends BaseEvent {
  eventType: 'ORDER_STATUS_CHANGED'
  data: {
    orderId: UUID
    userId: UUID
    previousStatus: OrderStatus
    newStatus: OrderStatus
    reason?: string
  }
}

export interface OrderCancelledEvent extends BaseEvent {
  eventType: 'ORDER_CANCELLED'
  data: {
    orderId: UUID
    userId: UUID
    reason: string
    refundAmount?: number
  }
}

// Payment events
export interface PaymentProcessedEvent extends BaseEvent {
  eventType: 'PAYMENT_PROCESSED'
  data: {
    orderId: UUID
    userId: UUID
    paymentId: UUID
    amount: number
    currency: string
    method: string
    status: 'SUCCESS' | 'FAILED'
  }
}

// Notification events
export interface NotificationEvent extends BaseEvent {
  eventType: 'NOTIFICATION_REQUESTED'
  data: {
    userId: UUID
    type: 'EMAIL' | 'SMS' | 'PUSH'
    template: string
    recipient: string
    subject?: string
    payload: Record<string, any>
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  }
}

// Event union type
export type DomainEvent = 
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderCancelledEvent
  | PaymentProcessedEvent
  | NotificationEvent

// EventBridge event wrapper
export interface EventBridgeEvent<T extends BaseEvent = DomainEvent> {
  version: string
  id: UUID
  'detail-type': string
  source: string
  account: string
  time: ISO8601
  region: string
  detail: T
}

// SQS message wrapper
export interface SQSEventRecord<T extends BaseEvent = DomainEvent> {
  messageId: string
  receiptHandle: string
  body: string
  attributes: {
    ApproximateReceiveCount: string
    SentTimestamp: string
    SenderId: string
    ApproximateFirstReceiveTimestamp: string
  }
  messageAttributes: Record<string, any>
  md5OfBody: string
  eventSource: string
  eventSourceARN: string
  awsRegion: string
  parsedBody?: T
}