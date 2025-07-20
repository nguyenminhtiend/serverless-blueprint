import { AuditFields, UUID } from './common'
import { DynamoDBItem, OrderKey, UserKey } from './database'

// Order status
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

// Order entity
export interface Order extends AuditFields {
  id: UUID
  userId: UUID
  status: OrderStatus
  items: OrderItem[]
  totals: OrderTotals
  shipping: ShippingInfo
  payment: PaymentInfo
  metadata?: OrderMetadata
}

// Order item
export interface OrderItem {
  productId: UUID
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  metadata?: Record<string, any>
}

// Order totals
export interface OrderTotals {
  subtotal: number
  tax: number
  shipping: number
  discount: number
  total: number
  currency: string
}

// Shipping information
export interface ShippingInfo {
  method: 'STANDARD' | 'EXPRESS' | 'OVERNIGHT'
  address: {
    name: string
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  estimatedDelivery?: string
  trackingNumber?: string
}

// Payment information
export interface PaymentInfo {
  method: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER'
  status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'
  transactionId?: string
  lastFourDigits?: string
  expiryDate?: string
}

// Order metadata
export interface OrderMetadata {
  source: 'WEB' | 'MOBILE' | 'API'
  promotionCodes?: string[]
  notes?: string
  tags?: string[]
}

// DynamoDB representation
export interface OrderDynamoItem extends DynamoDBItem {
  PK: OrderKey
  SK: 'DETAILS'
  GSI1PK: 'ORDER_STATUS'
  GSI1SK: OrderStatus
  GSI2PK: UserKey
  GSI2SK: string // createdAt for sorting user orders
  entityType: 'ORDER'
  data: Order
}

// Order DTOs
export interface CreateOrderRequest {
  userId: UUID
  items: Omit<OrderItem, 'totalPrice'>[]
  shipping: ShippingInfo
  payment: Omit<PaymentInfo, 'status' | 'transactionId'>
  promotionCodes?: string[]
  notes?: string
}

export interface UpdateOrderRequest {
  status?: OrderStatus
  shipping?: Partial<ShippingInfo>
  payment?: Partial<PaymentInfo>
  metadata?: Partial<OrderMetadata>
}

// Order query types
export interface GetOrderRequest {
  orderId: UUID
  userId?: UUID // Optional for admin access
}

export interface ListOrdersRequest {
  userId?: UUID
  status?: OrderStatus
  startDate?: string
  endDate?: string
  limit?: number
  cursor?: string
}

export interface OrdersByStatusRequest {
  status: OrderStatus
  limit?: number
  cursor?: string
}