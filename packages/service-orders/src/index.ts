// Export the configured handler from router
export { handler } from './router';

// Export all handlers and services for testing
export * from './handlers';
export * from './services';

// Export schemas (avoiding conflicts with events)
export * from './schemas';

// Export specific event items to avoid naming conflicts
export {
  OrderEventPublisher,
  publishOrderCreatedEvent,
  EventPublishResult,
  EventPublisherConfig,
  createOrderCreatedEvent,
  validateOrderCreatedEvent,
  EVENT_TYPES,
} from './events';
