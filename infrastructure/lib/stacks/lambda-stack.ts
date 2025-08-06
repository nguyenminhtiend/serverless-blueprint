import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { AuthFunction } from '../constructs/functions/auth-function';
import { UserFunction } from '../constructs/functions/user-function';
import { OrderFunction } from '../constructs/functions/order-function';
import { NotificationFunction } from '../constructs/functions/notification-function';

export interface LambdaStackProps extends cdk.StackProps {
  readonly environment?: string;
  readonly config: EnvironmentConfig;
  readonly table: dynamodb.Table;
  readonly userPool?: cognito.UserPool;
  readonly userPoolClient?: cognito.UserPoolClient;
  readonly notificationQueue?: sqs.Queue;
  readonly eventBusName?: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly authFunction: AuthFunction;
  public readonly userFunction: UserFunction;
  public readonly orderFunction: OrderFunction;
  public readonly notificationFunction: NotificationFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const environment = props.environment || 'dev';
    const { config, table, userPool, userPoolClient, notificationQueue, eventBusName } = props;

    // Create Lambda functions using the new constructs
    this.authFunction = new AuthFunction(this, 'AuthFunction', {
      environment,
      config,
      userPool,
      userPoolClient,
    });

    this.userFunction = new UserFunction(this, 'UserFunction', {
      environment,
      config,
      userPool,
    });

    this.orderFunction = new OrderFunction(this, 'OrderFunction', {
      environment,
      config,
      eventBusName,
    });

    this.notificationFunction = new NotificationFunction(this, 'NotificationFunction', {
      environment,
      config,
      notificationQueue,
    });

    // Add DynamoDB permissions to all functions
    const functions = [this.authFunction, this.userFunction, this.orderFunction, this.notificationFunction];
    functions.forEach(func => {
      func.addDynamoDbPermissions(table.tableArn);
    });


    // Outputs for other stacks
    new cdk.CfnOutput(this, 'AuthFunctionArn', {
      value: this.authFunction.functionArn,
      description: 'Auth service Lambda function ARN',
      exportName: `${environment}-auth-function-arn`,
    });

    new cdk.CfnOutput(this, 'UserFunctionArn', {
      value: this.userFunction.functionArn,
      description: 'User service Lambda function ARN',
      exportName: `${environment}-user-function-arn`,
    });

    new cdk.CfnOutput(this, 'OrderFunctionArn', {
      value: this.orderFunction.functionArn,
      description: 'Order service Lambda function ARN',
      exportName: `${environment}-order-function-arn`,
    });

    new cdk.CfnOutput(this, 'NotificationFunctionArn', {
      value: this.notificationFunction.functionArn,
      description: 'Notification service Lambda function ARN',
      exportName: `${environment}-notification-function-arn`,
    });
  }

}
