import { BaseEvent } from './base';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  productName: string;
}

export interface OrderCreatedData {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'PENDING';
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface OrderStatusChangedData {
  orderId: string;
  userId: string;
  previousStatus: string;
  newStatus: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  changedBy: string;
  reason?: string;
}

export interface OrderCancelledData {
  orderId: string;
  userId: string;
  reason: string;
  refundAmount: number;
}

export type OrderCreatedEvent = BaseEvent<OrderCreatedData> & {
  eventType: 'ORDER_CREATED';
  source: 'order.service';
};

export type OrderStatusChangedEvent = BaseEvent<OrderStatusChangedData> & {
  eventType: 'ORDER_STATUS_CHANGED';
  source: 'order.service';
};

export type OrderCancelledEvent = BaseEvent<OrderCancelledData> & {
  eventType: 'ORDER_CANCELLED';
  source: 'order.service';
};

export type OrderEvent = OrderCreatedEvent | OrderStatusChangedEvent | OrderCancelledEvent;
