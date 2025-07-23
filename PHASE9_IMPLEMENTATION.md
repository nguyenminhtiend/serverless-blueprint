# Phase 9: Event-Driven Services Implementation

This document describes the implementation of Phase 9, which creates a complete event-driven notification system using AWS EventBridge, SQS, and Lambda.

## 🏗️ Architecture Overview

```
Order Service → EventBridge → SQS Queue → Notifications Service
                          ↓
                       DLQ (Failed Events)
```

## 📦 Components Implemented

### 1. Centralized Event Publisher (`shared-core/event-publisher.ts`)

**Enhanced Features:**
- Robust retry logic with exponential backoff
- Structured logging with Pino integration
- Batch event publishing support
- Health monitoring capabilities
- Type-safe event creation

**Key Methods:**
```typescript
// Publish single event
const result = await publishEvent(domainEvent);

// Publish multiple events
const results = await publishEvents([event1, event2]);

// Create typed event
const event = createDomainEvent<OrderCreatedEvent>('ORDER_CREATED', 'orders-service', data);
```

### 2. Notifications Service Package (`service-notifications/`)

**Structure:**
```
service-notifications/
├── src/
│   ├── handlers/
│   │   └── event-handler.ts       # SQS event processing
│   ├── services/
│   │   ├── email-service.ts       # AWS SES integration
│   │   ├── sms-service.ts         # AWS SNS integration
│   │   └── notification-service.ts # Main orchestrator
│   ├── types/
│   │   └── notification.ts        # Zod schemas & types
│   └── utils/
│       └── test-integration.ts    # Testing utilities
```

**Key Features:**
- **Multi-channel support**: Email (SES) and SMS (SNS)
- **Template system**: Configurable email/SMS templates
- **Type-safe validation**: Zod schemas for all notification types
- **Error handling**: Comprehensive error tracking and logging
- **Batch processing**: Handle multiple notifications efficiently

### 3. Enhanced Events Stack (`infrastructure/events-stack.ts`)

**EventBridge Rules:**
- `ORDER_CREATED` → Notification Queue
- `ORDER_STATUS_CHANGED` → Notification Queue  
- `ORDER_CANCELLED` → Notification Queue
- `PAYMENT_PROCESSED` → Notification Queue
- `USER_CREATED` → Notification Queue

**SQS Configuration:**
- **Notification Queue**: Main processing queue
- **Dead Letter Queue**: Failed message handling
- **Message grouping**: Organized by service type
- **Visibility timeout**: Optimized for processing time

### 4. Updated Lambda Stack (`infrastructure/lambda-stack.ts`)

**Notification Function:**
- **Event Source**: SQS with batch processing (up to 10 messages)
- **Timeout**: 60 seconds for notification processing
- **IAM Permissions**: SES, SNS, SQS, DynamoDB access
- **Environment Variables**: Email/SMS configuration

## 🔄 Event Flow

### 1. Event Creation
```typescript
// In Order Service
const orderEvent = createOrderCreatedEvent(orderId, userId, orderData);
await publishOrderCreatedEvent(orderEvent);
```

### 2. Event Processing
```
EventBridge → SQS Queue → Lambda (Notification Service)
                       ↓
                   Process Event → Send Notifications
                                 ↓
                            SES (Email) / SNS (SMS)
```

### 3. Error Handling
```
Failed Processing → SQS Retry (3 attempts) → Dead Letter Queue
```

## 📧 Notification Types Supported

### Email Notifications (via AWS SES)
- **ORDER_CREATED**: Order confirmation with details
- **ORDER_STATUS_CHANGED**: Status updates with tracking
- **ORDER_CANCELLED**: Cancellation with refund info
- **PAYMENT_PROCESSED**: Payment confirmation
- **USER_WELCOME**: Welcome email for new users

### SMS Notifications (via AWS SNS)
- **ORDER_CREATED**: Simple order confirmation
- **ORDER_STATUS_CHANGED**: Status update with tracking URL
- **ORDER_CANCELLED**: Cancellation notification
- **PAYMENT_PROCESSED**: Payment confirmation

## 🧪 Testing & Validation

### Integration Test
```bash
# Run from notifications service directory
npm run test:integration
```

### Test Components
1. **Health Checks**: Verify all services are operational
2. **Notification Service**: Test direct notification processing
3. **Event Publishing**: Test EventBridge integration (if configured)

### Manual Testing
```typescript
import { runIntegrationTest } from './utils/test-integration';
await runIntegrationTest();
```

## 🔧 Configuration

### Environment Variables

**Lambda Function:**
```bash
FROM_EMAIL_ADDRESS=noreply@yourapp.com
REPLY_TO_ADDRESSES=support@yourapp.com
SMS_SENDER_ID=YourApp
EVENT_BUS_NAME=serverless-events-dev
DEFAULT_USER_EMAIL=user@example.com  # For testing
DEFAULT_USER_PHONE=+1234567890       # For testing
```

**CDK Deployment:**
```bash
# Set these in your environment before deployment
export FROM_EMAIL_ADDRESS="noreply@yourapp.com"
export SMS_SENDER_ID="YourApp"
```

## 🚀 Deployment

### 1. Build Services
```bash
pnpm build
```

### 2. Deploy Infrastructure
```bash
cd infrastructure
pnpm cdk deploy EventsStack
pnpm cdk deploy LambdaStack
```

### 3. Verify Deployment
- Check EventBridge rules are created
- Verify SQS queues are configured
- Confirm Lambda function has SQS trigger
- Test notification service health endpoint

## 📊 Monitoring & Observability

### CloudWatch Logs
- **Event Publisher**: Structured logs for all event operations
- **Notification Service**: Detailed processing logs with request tracing
- **Error Tracking**: Failed notifications with full context

### CloudWatch Metrics
- **Event Success/Failure Rate**: EventBridge publishing metrics
- **Notification Processing Time**: Lambda duration metrics
- **Queue Depth**: SQS message backlog monitoring
- **Dead Letter Queue**: Failed message tracking

### X-Ray Tracing
- End-to-end request tracing from order creation to notification delivery
- Performance bottleneck identification
- Error root cause analysis

## 🔐 Security Considerations

### IAM Permissions
- **Least Privilege**: Functions only have necessary permissions
- **Resource-Specific**: ARNs specified where possible
- **Environment Isolation**: Permissions scoped by environment

### Data Protection
- **Email Content**: No sensitive data in email templates
- **SMS Content**: Minimal PII in SMS messages
- **Logging**: Sensitive data excluded from logs

## 🎯 Performance Optimizations

### Event Processing
- **Batch Processing**: Handle up to 10 SQS messages simultaneously
- **Parallel Notifications**: Send email and SMS concurrently
- **Connection Pooling**: Reuse AWS SDK clients

### Cost Optimization
- **ARM64 Architecture**: 20% cost reduction on Lambda
- **Right-sized Memory**: Optimized for notification workloads
- **Log Retention**: Different retention periods by environment

## 🔄 Future Enhancements

### Push Notifications
- Firebase Cloud Messaging (FCM) integration
- Apple Push Notification Service (APNS) support
- WebSocket real-time notifications

### Advanced Features
- **Template Engine**: Handlebars or similar for rich templates
- **A/B Testing**: Multiple template variants
- **Analytics**: Open rates, click-through rates
- **Scheduling**: Delayed notifications
- **Preferences**: User notification preferences

### Reliability
- **Circuit Breaker**: Prevent cascade failures
- **Rate Limiting**: Throttle notification sending
- **Idempotency**: Prevent duplicate notifications

## 📋 Event Schema Reference

### OrderCreatedEvent
```typescript
{
  eventId: string;
  eventType: 'ORDER_CREATED';
  source: 'orders-service';
  timestamp: string;
  data: {
    orderId: string;
    userId: string;
    items: OrderItem[];
    total: number;
    currency: string;
  };
}
```

### NotificationRequest
```typescript
{
  userId: string;
  type: 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | ...;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  recipient: string;
  template: string;
  subject?: string;
  payload: Record<string, unknown>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}
```

## ✅ Implementation Checklist

- [x] Centralized event publisher in shared-core
- [x] Notifications service package with handlers
- [x] Email service using AWS SES
- [x] SMS service using AWS SNS
- [x] Event-driven Lambda function
- [x] EventBridge rules for all event types
- [x] SQS queues with DLQ configuration
- [x] IAM permissions for all services
- [x] Integration testing utilities
- [x] Documentation and deployment guide

## 🎉 Success Criteria

✅ **Phase 9 Complete**: Event-driven notification system is fully operational with:
- Multi-channel notification support (Email, SMS)
- Robust error handling with DLQ
- Type-safe event processing
- Comprehensive monitoring and logging
- Production-ready configuration

The system now supports the complete event-driven architecture pattern, enabling decoupled microservices communication through EventBridge with reliable notification delivery.