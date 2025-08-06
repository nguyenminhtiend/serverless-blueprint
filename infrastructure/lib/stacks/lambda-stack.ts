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

    // CloudWatch Alarms for monitoring (production only to reduce costs)
    if (environment === 'prod') {
      this.createCloudWatchAlarms(environment);
    }

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

  private createCloudWatchAlarms(environment: string) {
    const functions = [
      { func: this.authFunction, name: 'Auth' },
      { func: this.userFunction, name: 'User' },
      { func: this.orderFunction, name: 'Order' },
      { func: this.notificationFunction, name: 'Notification' },
    ];

    functions.forEach(({ func, name }) => {
      // Error rate alarm
      new cdk.aws_cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `${environment}-${name.toLowerCase()}-service-errors`,
        alarmDescription: `High error rate for ${name} service`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Duration alarm
      new cdk.aws_cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        alarmName: `${environment}-${name.toLowerCase()}-service-duration`,
        alarmDescription: `High duration for ${name} service`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10000, // 10 seconds
        evaluationPeriods: 3,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Throttles alarm
      new cdk.aws_cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        alarmName: `${environment}-${name.toLowerCase()}-service-throttles`,
        alarmDescription: `Throttling detected for ${name} service`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });
  }
}
