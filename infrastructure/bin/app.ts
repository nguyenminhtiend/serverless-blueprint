#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { ApiGatewayStack } from '../lib/stacks/api-gateway-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { EventsStack } from '../lib/stacks/events-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { TaggingAspect } from '../lib/aspects/tagging-aspect';
import { TaggingConfigFactory } from '../lib/config/tagging-config';
import { EnvironmentConfigFactory } from '../lib/config/environment-config';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Create environment-specific configuration
const config = EnvironmentConfigFactory.create(environment);

// Validate required parameters
if (!config.account) {
  throw new Error(
    'Account must be specified either via context or CDK_DEFAULT_ACCOUNT environment variable'
  );
}

// Common stack props
const stackProps: cdk.StackProps = {
  env: {
    account: config.account,
    region: config.region,
  },
  description: `Serverless Microservices - ${environment} environment`,
};

// Phase 1: Foundational Stacks (can deploy in parallel)
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

// Phase 2: Compute Stack (depends on Phase 1)
// Lambda Stack - Phase 4
const lambdaStack = new LambdaStack(app, `ServerlessMicroservices-Lambda-${environment}`, {
  ...stackProps,
  environment,
  config,
  table: databaseStack.table,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
  notificationQueue: eventsStack.notificationQueue,
  eventBusName: eventsStack.eventBus.eventBusName,
  description: `Lambda functions for ${environment} environment`,
});

// Phase 3: API Stack (depends on Phase 2)
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

// Explicit Stack Dependencies - Deployment Order
// Phase 1: Lambda depends on all foundational stacks (Database, Cognito, Events)
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(cognitoStack);
lambdaStack.addDependency(eventsStack);

// Phase 2: API Gateway depends on Lambda and Cognito
apiGatewayStack.addDependency(lambdaStack);
apiGatewayStack.addDependency(cognitoStack);

// Apply comprehensive tagging aspect to entire app
const taggingConfig = TaggingConfigFactory.create(environment);
const taggingAspect = new TaggingAspect(taggingConfig);

cdk.Aspects.of(app).add(taggingAspect);

// Stack naming convention is set in cdk.json context
