import { createDomainEvent, publishEvent } from '@shared/core';
import { OrderCreatedEvent } from '@shared/types';
import { NotificationService } from '../services/notification-service';

/**
 * Integration test utilities for the notification service
 * Used to validate end-to-end event-driven workflow
 */

/**
 * Create a test ORDER_CREATED event
 */
export const createTestOrderCreatedEvent = (
  orderId: string = '12345-test',
  userId: string = 'user-test-123'
): OrderCreatedEvent => {
  return createDomainEvent<OrderCreatedEvent>(
    'ORDER_CREATED',
    'orders-service',
    {
      orderId,
      userId,
      items: [
        {
          productId: 'product-123',
          quantity: 2,
          unitPrice: 49.99,
        },
        {
          productId: 'product-456',
          quantity: 1,
          unitPrice: 99.99,
        },
      ],
      total: 199.97,
      currency: 'USD',
    },
    {
      correlationId: `test-correlation-${Date.now()}`,
    }
  );
};

/**
 * Test event publishing to EventBridge
 */
export const testEventPublishing = async (): Promise<void> => {
  console.log('🧪 Testing event publishing...');

  const testEvent = createTestOrderCreatedEvent();

  try {
    const result = await publishEvent(testEvent);

    if (result.success) {
      console.log('✅ Event published successfully:', {
        eventId: testEvent.eventId,
        eventType: testEvent.eventType,
        publishedEventId: result.eventId,
      });
    } else {
      console.error('❌ Event publishing failed:', {
        eventId: testEvent.eventId,
        errorCode: result.failureCode,
        errorMessage: result.failureReason,
      });
    }
  } catch (error) {
    console.error('❌ Event publishing error:', error);
  }
};

/**
 * Test notification service directly
 */
export const testNotificationService = async (): Promise<void> => {
  console.log('🧪 Testing notification service...');

  const notificationService = new NotificationService({
    email: {
      fromAddress: 'test@example.com',
    },
    sms: {
      senderId: 'TestApp',
    },
  });

  // Test email notification
  try {
    const emailResult = await notificationService.processNotification({
      userId: 'test-user-123',
      type: 'ORDER_CREATED',
      channel: 'EMAIL',
      recipient: 'user@example.com',
      template: 'order-created',
      subject: 'Test Order Confirmation',
      payload: {
        orderId: '12345-test',
        total: 199.97,
        itemCount: 2,
      },
      priority: 'HIGH',
    });

    if (emailResult.success) {
      console.log('✅ Email notification processed successfully:', {
        messageId: emailResult.messageId,
      });
    } else {
      console.error('❌ Email notification failed:', {
        errorCode: emailResult.errorCode,
        errorMessage: emailResult.errorMessage,
      });
    }
  } catch (error) {
    console.error('❌ Notification service error:', error);
  }
};

/**
 * Test health checks
 */
export const testHealthChecks = async (): Promise<void> => {
  console.log('🧪 Testing health checks...');

  const notificationService = new NotificationService({
    email: {
      fromAddress: 'test@example.com',
    },
    sms: {
      senderId: 'TestApp',
    },
  });

  try {
    const health = await notificationService.getHealth();

    console.log('📊 Notification service health:', {
      overall: health.status,
      email: health.services.email.status,
      sms: health.services.sms.status,
      timestamp: health.timestamp,
    });

    if (health.status === 'healthy') {
      console.log('✅ All notification services are healthy');
    } else {
      console.warn('⚠️ Some notification services are unhealthy');
    }
  } catch (error) {
    console.error('❌ Health check error:', error);
  }
};

/**
 * Run comprehensive integration test
 */
export const runIntegrationTest = async (): Promise<void> => {
  console.log('🚀 Starting Event-Driven Notifications Integration Test');
  console.log('==================================================');

  await testHealthChecks();
  console.log('');

  await testNotificationService();
  console.log('');

  if (process.env.EVENT_BUS_NAME) {
    await testEventPublishing();
  } else {
    console.log('⏭️ Skipping event publishing test (EVENT_BUS_NAME not set)');
  }

  console.log('');
  console.log('🏁 Integration test completed');
};

// Export for CLI usage
if (require.main === module) {
  runIntegrationTest().catch(console.error);
}
