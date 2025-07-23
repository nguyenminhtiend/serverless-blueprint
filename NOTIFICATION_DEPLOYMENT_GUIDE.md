# Notification Service Deployment Guide

This guide covers deploying the Phase 9 Event-Driven Notification Service with cost-saving features for development environments.

## 🔧 Pre-Deployment Configuration

### Environment Variables

For **production** deployment (real notifications):
```bash
export ENABLE_MOCK_NOTIFICATIONS=false
export FROM_EMAIL_ADDRESS="noreply@yourcompany.com"
export REPLY_TO_ADDRESSES="support@yourcompany.com"
export SMS_SENDER_ID="YourCompany"
```

For **development** deployment (mock notifications - **DEFAULT**):
```bash
export ENABLE_MOCK_NOTIFICATIONS=true  # Default for dev environment
export FROM_EMAIL_ADDRESS="dev@example.com"
export SMS_SENDER_ID="DevApp"
```

### AWS Prerequisites

1. **AWS Account & CLI**: Configured with appropriate permissions
2. **SES Setup** (for production only):
   ```bash
   # Verify email addresses/domains in SES
   aws ses verify-email-identity --email-address noreply@yourcompany.com
   ```
3. **SNS SMS Setup** (for production only):
   ```bash
   # Check SMS spending limits and request increases if needed
   aws sns get-sms-attributes
   ```

## 🚀 Deployment Steps

### 1. Build All Services
```bash
# From project root
pnpm build
```

### 2. Deploy Infrastructure Stacks

Deploy in dependency order:

```bash
cd infrastructure

# 1. Database Stack
pnpm cdk deploy ServerlessMicroservices-Database-dev

# 2. Events Stack (includes SQS queues for notifications)
pnpm cdk deploy ServerlessMicroservices-Events-dev

# 3. Cognito Stack
pnpm cdk deploy ServerlessMicroservices-Cognito-dev

# 4. Lambda Stack (includes notification service)
pnpm cdk deploy ServerlessMicroservices-Lambda-dev

# 5. API Gateway Stack
pnpm cdk deploy ServerlessMicroservices-ApiGateway-dev
```

### 3. Deploy All at Once (Alternative)
```bash
cd infrastructure
pnpm cdk deploy --all
```

## 🔍 Verification

### 1. Check Stack Deployment
```bash
# Verify stacks are deployed
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Check specific stack
aws cloudformation describe-stacks --stack-name ServerlessMicroservices-Lambda-dev
```

### 2. Test Notification Service

**Option A: Via Order Creation (End-to-End)**
```bash
# Create a test order via API Gateway
curl -X POST https://your-api-gateway-url/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "items": [
      {"productId": "test-product", "quantity": 1, "price": 10.00}
    ],
    "shipping": {
      "address": "123 Test St",
      "city": "Test City",
      "state": "TS",
      "zipCode": "12345"
    },
    "payment": {"method": "CREDIT_CARD"}
  }'
```

**Option B: Direct Event Publishing Test**
```typescript
// Run integration test
import { runIntegrationTest } from '@serverless-blueprint/service-notifications';
await runIntegrationTest();
```

### 3. Monitor Logs

**CloudWatch Logs:**
```bash
# View notification service logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/dev-notification-service"

# Tail logs in real-time
aws logs tail /aws/lambda/dev-notification-service --follow
```

**Expected Log Output (Dev Mode):**
```json
{
  "level": "info",
  "message": "📧 MOCK EMAIL (not sent to avoid costs)",
  "type": "ORDER_CREATED",
  "recipient": "user@example.com",
  "subject": "Order Confirmation - #12345",
  "mockMessageId": "mock-email-1703123456789-abc123",
  "note": "Set ENABLE_MOCK_NOTIFICATIONS=false to send real emails"
}
```

## 💰 Cost Optimization Features

### Development Environment (Default)
- ✅ **Mock Mode Enabled**: No real emails/SMS sent
- ✅ **Log-Only**: All notifications logged for testing
- ✅ **No SES/SNS Charges**: Zero external API costs
- ✅ **CloudWatch Only**: Only Lambda + logging costs

### Production Environment
- 🔄 **Real Notifications**: Actual email/SMS delivery
- 💸 **SES Costs**: ~$0.10 per 1000 emails
- 💸 **SNS SMS Costs**: ~$0.0075 per SMS (US)
- 🔒 **IAM Permissions**: Full SES/SNS access required

### Toggle Between Modes
```bash
# Switch to production mode (real notifications)
export ENABLE_MOCK_NOTIFICATIONS=false
pnpm cdk deploy ServerlessMicroservices-Lambda-dev

# Switch back to dev mode (mock notifications)
export ENABLE_MOCK_NOTIFICATIONS=true
pnpm cdk deploy ServerlessMicroservices-Lambda-dev
```

## 🔍 Troubleshooting

### Common Issues

**1. TypeScript Build Errors**
```bash
# Clean and rebuild
pnpm clean
pnpm build
```

**2. CDK Deployment Fails**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Bootstrap CDK (if first time)
pnpm cdk bootstrap

# Check stack dependencies
pnpm cdk list
```

**3. Lambda Function Errors**
```bash
# Check function configuration
aws lambda get-function --function-name dev-notification-service

# View recent errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/dev-notification-service" \
  --filter-pattern "ERROR"
```

**4. SQS Queue Issues**
```bash
# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.region.amazonaws.com/account/notifications-dev \
  --attribute-names All

# Check dead letter queue
aws sqs receive-message \
  --queue-url https://sqs.region.amazonaws.com/account/serverless-dlq-dev
```

### Debug Mode

Enable detailed logging:
```bash
export LOG_LEVEL=DEBUG
export POWERTOOLS_LOG_LEVEL=DEBUG
pnpm cdk deploy ServerlessMicroservices-Lambda-dev
```

## 📊 Monitoring

### CloudWatch Dashboards

The deployment creates monitoring for:
- **Lambda Metrics**: Duration, errors, throttles
- **SQS Metrics**: Message count, DLQ messages
- **EventBridge Metrics**: Rule matches, failures

### Custom Metrics

Notification service automatically logs:

```json
{
  "level": "info", 
  "message": "Notification processed",
  "type": "ORDER_CREATED",
  "channel": "EMAIL",
  "success": true,
  "duration": 150,
  "mockMode": true
}
```

### Alerts

Production deployments include CloudWatch alarms for:
- High error rates (>5 errors in 5 minutes)
- Long durations (>10 seconds)
- Function throttling

## 🔄 Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy Notification Service
on:
  push:
    branches: [main]
    paths: ['packages/service-notifications/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
      
      - name: Deploy
        run: |
          cd infrastructure
          pnpm cdk deploy ServerlessMicroservices-Lambda-${{ github.ref_name }} --require-approval=never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          ENABLE_MOCK_NOTIFICATIONS: ${{ github.ref_name == 'main' && 'false' || 'true' }}
```

## 🧪 Testing

### Unit Tests
```bash
cd packages/service-notifications
pnpm test
```

### Integration Tests
```bash
cd packages/service-notifications
pnpm test:integration
```

### Load Testing
```bash
# Test notification throughput
ab -n 100 -c 10 -H "Content-Type: application/json" \
   -p test-order.json \
   https://your-api-gateway-url/orders
```

## 📈 Scaling Considerations

### Lambda Concurrency
- **Reserved Concurrency**: Set for notification function to prevent overwhelming downstream services
- **Provisioned Concurrency**: Consider for production high-traffic scenarios

### SQS Configuration
- **Batch Size**: Currently set to 10 messages
- **Visibility Timeout**: 60 seconds for notification processing
- **DLQ**: 3 retry attempts before moving to DLQ

### Rate Limiting
- **SES**: 14 emails/second (default), request increase for higher volumes
- **SNS SMS**: 1 SMS/second (default), request increase for higher volumes

## 🔐 Security

### IAM Permissions
The notification service has minimal required permissions:
- **SQS**: Receive and delete messages from notification queue
- **SES**: Send emails (production only)
- **SNS**: Publish SMS messages (production only)
- **CloudWatch**: Create logs and metrics

### Data Protection
- **No PII in Logs**: Sensitive data is not logged
- **Encryption**: All SQS messages encrypted at rest
- **VPC**: Consider VPC endpoints for enhanced security

## ✅ Success Criteria

Your deployment is successful when:

1. ✅ All CDK stacks deploy without errors
2. ✅ Notification Lambda function is created and configured
3. ✅ SQS queues are connected to EventBridge rules
4. ✅ Test order creation triggers mock notifications (dev mode)
5. ✅ CloudWatch logs show notification processing
6. ✅ No errors in Lambda function metrics
7. ✅ DLQ remains empty (no failed messages)

## 🎯 Next Steps

After successful deployment:

1. **Configure Real Notifications**: Set `ENABLE_MOCK_NOTIFICATIONS=false` for production
2. **Set Up SES Domain**: Verify your email domain in SES
3. **Configure SMS**: Set up SMS sender ID and spending limits
4. **Monitor Costs**: Set up billing alerts for SES/SNS usage
5. **Add Templates**: Customize email/SMS templates for your brand
6. **Scale Testing**: Perform load testing for expected traffic volumes

Your event-driven notification system is now ready for production use! 🎉