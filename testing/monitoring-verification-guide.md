# Monitoring & Observability Testing & Verification Guide

## Overview

This guide provides step-by-step instructions for testing and verifying the Phase 10 monitoring implementation. It covers dashboard verification, alarm testing, metrics validation, and X-Ray tracing confirmation.

## Prerequisites

1. AWS CDK deployed with monitoring stack
2. Lambda functions deployed with enhanced logging
3. AWS CLI configured with appropriate permissions
4. CloudWatch access in AWS Console

## 1. Infrastructure Verification

### 1.1 Verify CloudWatch Dashboards

```bash
# List all dashboards
aws cloudwatch list-dashboards --query 'DashboardEntries[?contains(DashboardName, `ServerlessMicroservices`)]'

# Expected output:
# - ServerlessMicroservices-Overview-{environment}
# - ServerlessMicroservices-Business-{environment}
```

**Manual Verification:**
1. Open AWS CloudWatch Console
2. Navigate to "Dashboards"
3. Verify both dashboards exist:
   - `ServerlessMicroservices-Overview-{env}`
   - `ServerlessMicroservices-Business-{env}`
4. Check all widgets are populated (may show "No data" initially)

### 1.2 Verify SNS Topics

```bash
# List SNS topics for alerting
aws sns list-topics --query 'Topics[?contains(TopicArn, `serverless-critical`) || contains(TopicArn, `serverless-warning`)]'

# Expected output:
# - arn:aws:sns:region:account:serverless-critical-{environment}
# - arn:aws:sns:region:account:serverless-warning-{environment}
```

### 1.3 Verify CloudWatch Alarms

```bash
# List all monitoring alarms
aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, `Lambda-`) || contains(AlarmName, `API-`) || contains(AlarmName, `DynamoDB-`)].{Name:AlarmName,State:StateValue}'

# Expected alarm categories:
# - Lambda-{function}-ErrorRate-{env}
# - Lambda-{function}-Duration-{env}
# - Lambda-{function}-Memory-{env}
# - API-5xx-ErrorRate-{env}
# - API-Latency-{env}
# - DynamoDB-ReadThrottle-{env}
# - DynamoDB-WriteThrottle-{env}
```

### 1.4 Verify Log Groups

```bash
# List all service log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/serverless-" --query 'logGroups[].logGroupName'

# Expected output:
# - /aws/lambda/serverless-auth-{environment}
# - /aws/lambda/serverless-users-{environment}
# - /aws/lambda/serverless-orders-{environment}
# - /aws/lambda/serverless-notifications-{environment}
```

## 2. Functional Testing

### 2.1 Test Enhanced Logging

Create a test Lambda function to verify logging and metrics:

```typescript
// test-monitoring-function.ts
import { withTracingAndMonitoring, createLogger } from '@shared/core'

const testHandler = async (event: any, context: any, logger: any) => {
  logger.info('Test handler started', { testId: 'monitoring-001' })

  // Test business metric
  logger.businessMetric('TestMetric', 42, { category: 'testing' })

  // Test counter
  logger.increment('TestCounter', 5)

  // Test timing
  const start = Date.now()
  await new Promise(resolve => setTimeout(resolve, 100))
  logger.timing('TestOperation', Date.now() - start)

  // Test success tracking
  logger.success('TestOperation')

  return { statusCode: 200, body: JSON.stringify({ test: 'success' }) }
}

export const handler = withTracingAndMonitoring(testHandler, 'TestService')
```

**Deploy and Test:**
```bash
# Deploy test function
aws lambda create-function \
  --function-name test-monitoring \
  --runtime nodejs22.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://test-function.zip

# Invoke test function
aws lambda invoke \
  --function-name test-monitoring \
  --payload '{"test": true}' \
  response.json
```

**Verify Results:**
```bash
# Check CloudWatch logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/test-monitoring" \
  --start-time $(date -d "5 minutes ago" +%s)000

# Look for:
# - Structured JSON logs
# - Memory usage tracking
# - Performance timing
# - Business metrics logging
```

### 2.2 Test Custom Metrics Emission

```bash
# Check custom metrics in CloudWatch
aws cloudwatch list-metrics \
  --namespace "ServerlessMicroservices/TestService" \
  --query 'Metrics[].{MetricName:MetricName,Dimensions:Dimensions}'

# Expected metrics:
# - TestMetric
# - TestCounter
# - TestOperation.Duration
# - TestOperation.Success
# - MemoryUtilization
```

### 2.3 Test X-Ray Tracing

**Verify X-Ray Service Map:**
1. Open AWS X-Ray Console
2. Navigate to "Service map"
3. Look for your test service nodes
4. Verify traces are being captured

**Query X-Ray Traces:**
```bash
# Get traces for the last 5 minutes
aws xray get-trace-summaries \
  --time-range-type TimeRangeByStartTime \
  --start-time $(date -d "5 minutes ago" +%s) \
  --end-time $(date +%s) \
  --query 'TraceSummaries[?contains(Id, `TestService`)]'
```

## 3. Alarm Testing

### 3.1 Test Error Rate Alarm

**Trigger Lambda Error:**
```typescript
// Create a function that throws errors
const errorHandler = async (event: any, context: any, logger: any) => {
  logger.error('Intentional test error')
  throw new Error('Test error for alarm verification')
}

export const handler = withTracingAndMonitoring(errorHandler, 'ErrorTestService')
```

**Execute Multiple Times:**
```bash
# Invoke 10 times to trigger error rate alarm
for i in {1..10}; do
  aws lambda invoke \
    --function-name error-test-service \
    --payload '{}' \
    /dev/null
  sleep 1
done
```

**Verify Alarm State:**
```bash
# Check if error rate alarm triggered
aws cloudwatch describe-alarms \
  --alarm-names "Lambda-ErrorTestService-ErrorRate-dev" \
  --query 'MetricAlarms[0].StateValue'
```

### 3.2 Test Memory Utilization Alarm

Create a memory-intensive function:
```typescript
const memoryTestHandler = async (event: any, context: any, logger: any) => {
  // Allocate memory to trigger alarm
  const largeArray = new Array(1000000).fill('test data')
  logger.trackMemoryUsage()

  return { statusCode: 200, body: 'Memory test complete' }
}
```

### 3.3 Test Latency Alarm

Create a slow function:
```typescript
const slowHandler = async (event: any, context: any, logger: any) => {
  await new Promise(resolve => setTimeout(resolve, 6000)) // 6 seconds
  return { statusCode: 200, body: 'Slow operation complete' }
}
```

## 4. Dashboard Verification

### 4.1 Service Overview Dashboard

**Check Widget Data:**
1. Open ServiceOverview dashboard
2. Verify widgets show data:
   - API Gateway requests/errors
   - API Gateway latency
   - Lambda invocations/errors/duration for each service
   - DynamoDB read/write capacity
   - DynamoDB throttles/errors

### 4.2 Business Metrics Dashboard

**Verify Business Metrics:**
1. Open Business dashboard
2. Check for custom metrics:
   - Order creation rate
   - Order failure rate
   - Authentication success/failure
   - User registration rate

## 5. CloudWatch Insights Testing

### 5.1 Test Log Queries

```sql
-- Query 1: Find all errors in the last hour
fields @timestamp, @message, service, level, err
| filter level = "ERROR"
| sort @timestamp desc
| limit 20

-- Query 2: Performance analysis
fields @timestamp, @message, operation, duration
| filter @message like /Performance:/
| stats avg(duration), max(duration), min(duration) by operation
| sort avg(duration) desc

-- Query 3: Memory utilization tracking
fields @timestamp, service, memoryUtilization
| filter @message like /Memory Usage/
| stats avg(memoryUtilization), max(memoryUtilization) by service

-- Query 4: Business metrics analysis
fields @timestamp, metricName, value, service
| filter type = "business"
| stats sum(value) by metricName, service
```

## 6. End-to-End Testing

### 6.1 Complete User Journey Test

```bash
# Simulate complete user journey
USER_TOKEN=$(curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Create order
ORDER_ID=$(curl -X POST $API_URL/orders \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"123","quantity":2}]}' \
  | jq -r '.orderId')

# Update profile
curl -X PUT $API_URL/users/profile \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'
```

**Verify in Dashboards:**
1. Check API Gateway metrics show increased traffic
2. Verify Lambda functions show invocations
3. Confirm business metrics increment
4. Check X-Ray shows complete trace

## 7. Performance Validation

### 7.1 Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Create load test configuration
cat > load-test.yml << EOF
config:
  target: '$API_URL'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: 'Order Creation'
    requests:
      - post:
          url: '/orders'
          headers:
            Authorization: 'Bearer {{auth_token}}'
          json:
            items:
              - productId: '123'
                quantity: 1
EOF

# Run load test
artillery run load-test.yml
```

**Monitor During Load Test:**
1. Watch dashboards for real-time metrics
2. Verify alarms don't trigger under normal load
3. Check X-Ray service map updates
4. Monitor custom metrics emission

## 8. Verification Checklist

### Infrastructure ✅
- [ ] CloudWatch dashboards created and accessible
- [ ] SNS topics created for critical/warning alerts
- [ ] CloudWatch alarms configured with correct thresholds
- [ ] Log groups created with proper retention policies
- [ ] X-Ray tracing enabled for all services

### Logging ✅
- [ ] Structured JSON logs appearing in CloudWatch
- [ ] Memory usage tracking working
- [ ] Performance timing captured
- [ ] Business metrics logged
- [ ] Error logging with proper context
- [ ] Correlation IDs tracking across services

### Metrics ✅
- [ ] Custom metrics appearing in CloudWatch
- [ ] Business metrics namespace created
- [ ] Memory utilization metrics emitted
- [ ] Performance timing metrics recorded
- [ ] Success/failure counters working

### Tracing ✅
- [ ] X-Ray service map showing services
- [ ] End-to-end traces captured
- [ ] Subsegments for database operations
- [ ] HTTP request tracing working
- [ ] Error traces include stack traces

### Alerting ✅
- [ ] Critical alarms trigger appropriate notifications
- [ ] Warning alarms send to correct channels
- [ ] Business alarms working for failure rates
- [ ] Email notifications delivered
- [ ] Alarm states transition correctly

### Dashboards ✅
- [ ] Service overview shows all components
- [ ] Business metrics dashboard populated
- [ ] Widgets refresh with live data
- [ ] Drill-down functionality working
- [ ] Time range selection functional

## 9. Troubleshooting Common Issues

### Missing Metrics
```bash
# Check IAM permissions for CloudWatch
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --action-names cloudwatch:PutMetricData \
  --resource-arns "*"

# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name your-function-name \
  --query 'Environment.Variables'
```

### X-Ray Not Working
```bash
# Verify X-Ray service role permissions
aws iam get-role-policy \
  --role-name lambda-execution-role \
  --policy-name XRayWriteOnlyAccess

# Check X-Ray sampling rules
aws xray get-sampling-rules
```

### Alarms Not Triggering
```bash
# Check alarm configuration
aws cloudwatch describe-alarms \
  --alarm-names "your-alarm-name" \
  --query 'MetricAlarms[0].{Threshold:Threshold,ComparisonOperator:ComparisonOperator,EvaluationPeriods:EvaluationPeriods}'

# Check metric data points
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Lambda" \
  --metric-name "Errors" \
  --dimensions Name=FunctionName,Value=your-function-name \
  --start-time $(date -d "1 hour ago" -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## 10. Success Criteria

✅ **Phase 10 Complete When:**
- All monitoring infrastructure deployed successfully
- Custom metrics appearing in CloudWatch within 5 minutes
- X-Ray traces showing complete request flows
- Alarms trigger within expected timeframes
- Dashboards show live data from all services
- Log queries return structured, searchable data
- Performance impact < 5% on Lambda execution time
- MTTR < 15 minutes for issue detection and resolution

## 11. Next Steps

After successful verification:
1. Set up production alerting channels (PagerDuty, Slack)
2. Create runbooks for common alerts
3. Implement automated remediation for known issues
4. Schedule regular monitoring health checks
5. Train team on dashboard usage and troubleshooting