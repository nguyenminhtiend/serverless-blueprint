import * as cdk from 'aws-cdk-lib';
import { ApiGatewayStack } from './stacks/api-gateway-stack';
import { CognitoStack } from './stacks/cognito-stack';
import { DatabaseStack } from './stacks/database-stack';
import { EventsStack } from './stacks/events-stack';
import { LambdaStack } from './stacks/lambda-stack';

import { TaggingAspect } from './aspects/tagging-aspect';
import { TaggingConfigFactory } from './config/tagging-config';
import { EnvironmentConfigFactory } from './config/environment-config';

export class StackOrchestrator {
  private app: cdk.App;
  private environment: string;
  private config: any;
  private stackProps: cdk.StackProps;

  constructor(app: cdk.App) {
    this.app = app;
    this.environment = app.node.tryGetContext('environment') || 'dev';
    this.config = EnvironmentConfigFactory.create(this.environment);

    this.validateConfiguration();
    this.setupStackProps();
  }

  public deployStacks(): void {
    // Phase 1: Create foundational stacks
    const foundationalStacks = this.createFoundationalStacks();

    // Phase 2: Create compute stack
    const lambdaStack = this.createLambdaStack(foundationalStacks);

    // Phase 3: Create API stack
    const apiGatewayStack = this.createApiGatewayStack(
      lambdaStack,
      foundationalStacks.cognitoStack
    );

    // Configure stack dependencies
    this.configureDependencies(foundationalStacks, lambdaStack, apiGatewayStack);

    // Apply tagging
    this.applyTagging();
  }

  private validateConfiguration(): void {
    if (!this.config.account) {
      throw new Error(
        'Account must be specified either via context or CDK_DEFAULT_ACCOUNT environment variable'
      );
    }
  }

  private setupStackProps(): void {
    this.stackProps = {
      env: {
        account: this.config.account,
        region: this.config.region,
      },
      description: `Serverless Microservices - ${this.environment} environment`,
    };
  }

  private createFoundationalStacks() {
    const databaseStack = new DatabaseStack(
      this.app,
      `ServerlessMicroservices-Database-${this.environment}`,
      {
        ...this.stackProps,
        environment: this.environment,
        description: `DynamoDB infrastructure for ${this.environment} environment`,
      }
    );

    const cognitoStack = new CognitoStack(
      this.app,
      `ServerlessMicroservices-Cognito-${this.environment}`,
      {
        ...this.stackProps,
        environment: this.environment,
        webAppDomain: this.config.webApp.domain,
        additionalCallbackUrls: this.config.webApp.additionalCallbackUrls,
        additionalLogoutUrls: this.config.webApp.additionalLogoutUrls,
        description: `Cognito authentication infrastructure for ${this.environment} environment`,
      }
    );

    const eventsStack = new EventsStack(
      this.app,
      `ServerlessMicroservices-Events-${this.environment}`,
      {
        ...this.stackProps,
        environment: this.environment,
        description: `EventBridge and SQS infrastructure for ${this.environment} environment`,
      }
    );

    return { databaseStack, cognitoStack, eventsStack };
  }

  private createLambdaStack(foundationalStacks: any): LambdaStack {
    return new LambdaStack(this.app, `ServerlessMicroservices-Lambda-${this.environment}`, {
      ...this.stackProps,
      environment: this.environment,
      config: this.config,
      table: foundationalStacks.databaseStack.table,
      userPool: foundationalStacks.cognitoStack.userPool,
      userPoolClient: foundationalStacks.cognitoStack.userPoolClient,
      notificationQueue: foundationalStacks.eventsStack.notificationQueue,
      eventBusName: foundationalStacks.eventsStack.eventBus.eventBusName,
      description: `Lambda functions for ${this.environment} environment`,
    });
  }

  private createApiGatewayStack(
    lambdaStack: LambdaStack,
    cognitoStack: CognitoStack
  ): ApiGatewayStack {
    return new ApiGatewayStack(this.app, `ServerlessMicroservices-ApiGateway-${this.environment}`, {
      ...this.stackProps,
      environment: this.environment,
      authFunction: lambdaStack.authFunction,
      userFunction: lambdaStack.userFunction,
      orderFunction: lambdaStack.orderFunction,
      userPool: cognitoStack.userPool,
      userPoolClient: cognitoStack.userPoolClient,
      description: `API Gateway infrastructure for ${this.environment} environment`,
    });
  }

  private configureDependencies(
    foundationalStacks: any,
    lambdaStack: LambdaStack,
    apiGatewayStack: ApiGatewayStack
  ): void {
    // Phase 1: Lambda depends on all foundational stacks
    lambdaStack.addDependency(foundationalStacks.databaseStack);
    lambdaStack.addDependency(foundationalStacks.cognitoStack);
    lambdaStack.addDependency(foundationalStacks.eventsStack);

    // Phase 2: API Gateway depends on Lambda and Cognito
    apiGatewayStack.addDependency(lambdaStack);
    apiGatewayStack.addDependency(foundationalStacks.cognitoStack);
  }

  private applyTagging(): void {
    const taggingConfig = TaggingConfigFactory.create(this.environment);
    const taggingAspect = new TaggingAspect(taggingConfig);
    cdk.Aspects.of(this.app).add(taggingAspect);
  }
}
