# IAM Resources Created by CDK Infrastructure

This document outlines all IAM resources that will be created by the AWS CDK infrastructure in the `@infrastructure/` directory.

## Overview

The CDK stacks create various IAM roles, policies, and permissions to enable secure access between AWS services in the serverless microservices architecture.

## Lambda Function IAM Roles

### 1. Auth Function Role (`AuthFunction`)
**Created by**: `infrastructure/lib/constructs/functions/auth-function.ts:14`

**Service Role for**: `dev-auth-service` Lambda function

**Managed Policies**:
- `AWSLambdaBasicExecutionRole` (AWS managed)

**Inline Policies**:
- **CloudWatch Logs**: 
  - Actions: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
  - Resources: `arn:aws:logs:region:account:log-group:/aws/lambda/dev-*`
- **DynamoDB Access**:
  - Actions: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:Query`, `dynamodb:Scan`, `dynamodb:BatchGetItem`, `dynamodb:BatchWriteItem`
  - Resources: Main table ARN and GSI indexes
- **Cognito User Pool Management**:
  - Actions: `cognito-idp:AdminGetUser`, `cognito-idp:AdminUpdateUserAttributes`, `cognito-idp:AdminDeleteUser`, `cognito-idp:AdminSetUserPassword`, `cognito-idp:ListUsers`, `cognito-idp:AdminListGroupsForUser`, `cognito-idp:AdminAddUserToGroup`, `cognito-idp:AdminRemoveUserFromGroup`, `cognito-idp:GetUser`
  - Resources: Cognito User Pool ARN

### 2. User Function Role (`UserFunction`)
**Created by**: `infrastructure/lib/constructs/functions/user-function.ts:13`

**Service Role for**: `dev-user-service` Lambda function

**Managed Policies**:
- `AWSLambdaBasicExecutionRole` (AWS managed)
- `AWSXRayDaemonWriteAccess` (AWS managed)

**Inline Policies**:
- **CloudWatch Logs**: Same as Auth Function
- **DynamoDB Access**: Same as Auth Function  
- **Cognito User Pool Management**: Same as Auth Function

### 3. Order Function Role (`OrderFunction`)
**Created by**: `infrastructure/lib/constructs/functions/order-function.ts:13`

**Service Role for**: `dev-order-service` Lambda function

**Managed Policies**:
- `AWSLambdaBasicExecutionRole` (AWS managed)
- `AWSXRayDaemonWriteAccess` (AWS managed)

**Inline Policies**:
- **CloudWatch Logs**: Same as Auth Function
- **DynamoDB Access**: Same as Auth Function
- **EventBridge Events**:
  - Actions: `events:PutEvents`
  - Resources: `arn:aws:events:region:account:event-bus/serverless-events-dev`

### 4. Notification Function Role (`NotificationFunction`)
**Created by**: `infrastructure/lib/constructs/functions/notification-function.ts:15`

**Service Role for**: `dev-notification-service` Lambda function

**Managed Policies**:
- `AWSLambdaBasicExecutionRole` (AWS managed)
- `AWSXRayDaemonWriteAccess` (AWS managed)

**Inline Policies**:
- **CloudWatch Logs**: Same as Auth Function
- **DynamoDB Access**: Same as Auth Function
- **SQS Queue Access**:
  - Actions: `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes`
  - Resources: `arn:aws:sqs:region:account:*dev*`
- **SES Email Sending**:
  - Actions: `ses:SendEmail`, `ses:SendRawEmail`, `ses:SendBulkTemplatedEmail`, `ses:SendTemplatedEmail`
  - Resources: `*`
- **SNS SMS Sending**:
  - Actions: `sns:Publish`, `sns:GetSMSAttributes`, `sns:SetSMSAttributes`
  - Resources: `*`

## API Gateway IAM Resources

### JWT Authorizer
**Created by**: `infrastructure/lib/stacks/api-gateway-stack.ts:30`

**Type**: Cognito JWT Authorizer
**Configuration**:
- Identity Source: `$request.header.Authorization`
- JWT Audience: Cognito User Pool Client ID
- Issuer: `https://cognito-idp.region.amazonaws.com/user-pool-id`

## EventBridge IAM Permissions

### EventBridge Service Role
**Implicitly Created**: CDK automatically creates service roles for EventBridge rules

**Permissions**:
- **SQS Queue Access**: EventBridge rules can send messages to:
  - Notification Queue
  - Order Processing Queue
  - Dead Letter Queue

## Common IAM Patterns

### Base Lambda Function Permissions
**Defined in**: `infrastructure/lib/constructs/base-lambda-function.ts:64`

All Lambda functions inherit these base permissions:
1. **CloudWatch Logs**: Full logging permissions to function-specific log groups
2. **X-Ray Tracing**: Automatic tracing permissions when `tracing: ACTIVE` is enabled
3. **DynamoDB**: Full CRUD access to main table and GSI indexes

### Security Best Practices Implemented

1. **Least Privilege**: Each function only gets permissions for services it actually uses
2. **Resource-Specific ARNs**: Most policies target specific resources rather than using wildcards
3. **Environment Isolation**: Resource names include environment prefixes (`dev-`, `prod-`)
4. **Automatic Role Creation**: CDK creates unique execution roles for each Lambda function

## Resource Naming Convention

All IAM resources follow this naming pattern:
- **Lambda Execution Roles**: `{Environment}-{ServiceName}-Role-{UniqueId}`
- **Policy Names**: Inline policies are named based on the service they grant access to
- **Resource Prefixes**: All resources include environment identifier for isolation

## Monitoring and Compliance

### CloudTrail Integration
All IAM actions are automatically logged to CloudTrail when enabled at the account level.

### Resource Tags
IAM resources inherit tags from the CDK stacks:
- Environment: `dev`, `staging`, `prod`
- Project: `serverless-microservices`
- Owner: As specified in tagging configuration

## Security Considerations

1. **No Cross-Account Access**: All IAM roles are account-scoped
2. **No Admin Permissions**: No Lambda functions have administrative privileges
3. **Service-to-Service**: All permissions are for AWS service-to-service communication
4. **Temporary Credentials**: Lambda functions use temporary credentials via execution roles
5. **Encryption**: All data in transit and at rest uses AWS managed encryption

## Generated Resources Summary

| Resource Type | Count | Environment-Specific |
|---------------|-------|---------------------|
| Lambda Execution Roles | 4 | Yes |
| Inline IAM Policies | ~12 | Yes |
| JWT Authorizers | 1 | Yes |
| EventBridge Service Roles | Auto-created | Yes |

Total estimated IAM resources: **17-20 resources per environment**