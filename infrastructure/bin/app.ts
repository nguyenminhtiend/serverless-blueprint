#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { EventsStack } from '../lib/events-stack';
import { LambdaStack } from '../lib/lambda-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region =
  app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'ap-southeast-1';

// Validate required parameters
if (!account) {
  throw new Error(
    'Account must be specified either via context or CDK_DEFAULT_ACCOUNT environment variable'
  );
}

// Common stack props
const stackProps: cdk.StackProps = {
  env: {
    account,
    region,
  },
  description: `Serverless Microservices - ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'ServerlessMicroservices',
    ManagedBy: 'CDK',
  },
};

// Database Stack - Phase 3
const databaseStack = new DatabaseStack(app, `ServerlessMicroservices-Database-${environment}`, {
  ...stackProps,
  environment,
  description: `DynamoDB infrastructure for ${environment} environment`,
});

// Cognito Stack - Phase 7.1
const cognitoStack = new CognitoStack(app, `ServerlessMicroservices-Cognito-${environment}`, {
  ...stackProps,
  environment,
  description: `Cognito authentication infrastructure for ${environment} environment`,
});

// Events Stack - Phase 5
const eventsStack = new EventsStack(app, `ServerlessMicroservices-Events-${environment}`, {
  ...stackProps,
  environment,
  description: `EventBridge and SQS infrastructure for ${environment} environment`,
});

// Lambda Stack - Phase 4
const lambdaStack = new LambdaStack(app, `ServerlessMicroservices-Lambda-${environment}`, {
  ...stackProps,
  environment,
  table: databaseStack.table,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
  notificationQueue: eventsStack.notificationQueue,
  eventBusName: eventsStack.eventBus.eventBusName,
  description: `Lambda functions for ${environment} environment`,
});

// API Gateway Stack - Phase 4
const apiGatewayStack = new ApiGatewayStack(
  app,
  `ServerlessMicroservices-ApiGateway-${environment}`,
  {
    ...stackProps,
    environment,
    authFunction: lambdaStack.authFunction,
    userFunction: lambdaStack.userFunction,
    orderFunction: lambdaStack.orderFunction,
    userPool: cognitoStack.userPool,
    userPoolClient: cognitoStack.userPoolClient,
    description: `API Gateway infrastructure for ${environment} environment`,
  }
);

// Add stack dependencies
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(eventsStack);
lambdaStack.addDependency(cognitoStack); // Lambda needs Cognito for env vars
apiGatewayStack.addDependency(lambdaStack);
apiGatewayStack.addDependency(cognitoStack);

// Stack naming convention is set in cdk.json context
