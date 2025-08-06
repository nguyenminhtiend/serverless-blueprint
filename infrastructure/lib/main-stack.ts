import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseNestedStack } from './nested/database-nested-stack';
import { CognitoNestedStack } from './nested/cognito-nested-stack';
import { EventsNestedStack } from './nested/events-nested-stack';
import { LambdaNestedStack } from './nested/lambda-nested-stack';
import { ApiGatewayNestedStack } from './nested/api-gateway-nested-stack';
import { EnvironmentConfig } from './config/environment-config';

export interface MainStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  config: EnvironmentConfig;
  projectName: string;
}

export class MainStack extends cdk.Stack {
  public readonly database: DatabaseNestedStack;
  public readonly cognito: CognitoNestedStack;
  public readonly events: EventsNestedStack;
  public readonly lambda: LambdaNestedStack;
  public readonly apiGateway: ApiGatewayNestedStack;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const { environment, config, projectName } = props;

    // Apply tags to the main stack
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('DeployedAt', new Date().toISOString());

    // 1. Database stack (foundational)
    this.database = new DatabaseNestedStack(this, 'Database', {
      environment,
      projectName,
    });

    // 2. Cognito stack (foundational)
    this.cognito = new CognitoNestedStack(this, 'Cognito', {
      environment,
      projectName,
    });

    // 3. Events stack (foundational)
    this.events = new EventsNestedStack(this, 'Events', {
      environment,
      projectName,
    });

    // 4. Lambda stack (depends on database, cognito, and events)
    this.lambda = new LambdaNestedStack(this, 'Lambda', {
      environment,
      projectName,
      config,
      table: this.database.table,
      userPool: this.cognito.userPool,
      userPoolClient: this.cognito.userPoolClient,
      notificationQueue: this.events.notificationQueue,
      eventBusName: this.events.eventBus.eventBusName,
    });
    this.lambda.node.addDependency(this.database);
    this.lambda.node.addDependency(this.cognito);
    this.lambda.node.addDependency(this.events);

    // 5. API Gateway stack (depends on lambda and cognito)
    this.apiGateway = new ApiGatewayNestedStack(this, 'ApiGateway', {
      environment,
      projectName,
      authFunction: this.lambda.authFunction,
      userFunction: this.lambda.userFunction,
      orderFunction: this.lambda.orderFunction,
      userPool: this.cognito.userPool,
      userPoolClient: this.cognito.userPoolClient,
    });
    this.apiGateway.node.addDependency(this.lambda);
    this.apiGateway.node.addDependency(this.cognito);

    // Main stack outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiGateway.httpApi.apiEndpoint,
      description: 'API Gateway endpoint URL',
      exportName: `${environment}-main-api-url`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.cognito.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${environment}-main-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.database.table.tableName,
      description: 'DynamoDB table name',
      exportName: `${environment}-main-table-name`,
    });
  }
}