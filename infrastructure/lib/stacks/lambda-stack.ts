import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

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
  public readonly authFunction: nodejs.NodejsFunction;
  public readonly userFunction: nodejs.NodejsFunction;
  public readonly orderFunction: nodejs.NodejsFunction;
  public readonly notificationFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const environment = props.environment || 'dev';
    const { config, table, userPool, userPoolClient, notificationQueue, eventBusName } = props;

    // CloudWatch Logs retention based on environment
    const logRetention =
      environment === 'prod'
        ? logs.RetentionDays.ONE_MONTH // 30 days for prod (best practice)
        : logs.RetentionDays.ONE_DAY; // 1 day for dev (maximum cost optimization)

    // Memory allocation and timeout from config
    const memorySize = config!.lambda.memorySize;
    const timeout = config!.lambda.timeout;

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: timeout,
      memorySize: memorySize,
      environment: {
        TABLE_NAME: config!.dynamodb.tableName,
        NODE_ENV: config!.lambda.nodeEnv,
        LOG_LEVEL: environment === 'prod' ? 'WARN' : 'INFO',
        POWERTOOLS_SERVICE_NAME: 'serverless-microservices',
        POWERTOOLS_LOG_LEVEL: environment === 'prod' ? 'WARN' : 'INFO',
        POWERTOOLS_LOGGER_SAMPLE_RATE: environment === 'prod' ? '0.1' : '1',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
        POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
      },
      tracing: lambda.Tracing.ACTIVE,
      depsLockFilePath: '../pnpm-lock.yaml',
    };

    // Auth Service Function
    this.authFunction = new nodejs.NodejsFunction(this, 'AuthFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-auth-service`,
      entry: '../packages/service-auth/src/index.ts',
      description: 'Cognito-based authentication and authorization service',
      logGroup: new logs.LogGroup(this, 'AuthFunctionLogGroup', {
        logGroupName: `/aws/lambda/${environment}-auth-service`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        ...commonLambdaProps.environment,
        USER_POOL_ID: userPool?.userPoolId || '',
        CLIENT_ID: userPoolClient?.userPoolClientId || '',
        // AWS_REGION is automatically available in Lambda runtime
        // CLIENT_SECRET not needed for public clients
      },
    });

    // User Service Function
    this.userFunction = new nodejs.NodejsFunction(this, 'UserFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-user-service`,
      entry: '../packages/service-users/src/index.ts',
      description: 'User management service',
      logGroup: new logs.LogGroup(this, 'UserFunctionLogGroup', {
        logGroupName: `/aws/lambda/${environment}-user-service`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        ...commonLambdaProps.environment,
        COGNITO_USER_POOL_ID: userPool?.userPoolId || '',
      },
    });

    // Order Service Function
    this.orderFunction = new nodejs.NodejsFunction(this, 'OrderFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-order-service`,
      entry: '../packages/service-orders/src/index.ts',
      description: 'Order management service',
      logGroup: new logs.LogGroup(this, 'OrderFunctionLogGroup', {
        logGroupName: `/aws/lambda/${environment}-order-service`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        ...commonLambdaProps.environment,
        EVENT_BUS_NAME: eventBusName || `serverless-events-${environment}`,
      },
    });

    // Notification Service Function
    this.notificationFunction = new nodejs.NodejsFunction(this, 'NotificationFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-notification-service`,
      entry: '../packages/service-notifications/src/handlers/event-handler.ts',
      handler: 'handleNotificationEvents',
      description: 'Event-driven notification service',
      timeout: cdk.Duration.seconds(60), // Longer timeout for notification processing
      logGroup: new logs.LogGroup(this, 'NotificationFunctionLogGroup', {
        logGroupName: `/aws/lambda/${environment}-notification-service`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        ...commonLambdaProps.environment,
        FROM_EMAIL_ADDRESS: config!.notifications.email.fromAddress,
        REPLY_TO_ADDRESSES: config!.notifications.email.replyToAddresses.join(','),
        SMS_SENDER_ID: config!.notifications.sms.senderId,
        DEFAULT_USER_EMAIL: config!.notifications.email.defaultUserEmail,
        DEFAULT_USER_PHONE: config!.notifications.sms.defaultUserPhone,
        ENABLE_MOCK_NOTIFICATIONS: config!.notifications.enableMock.toString(),
      },
    });

    // Add SQS event source to notification function if queue is provided
    if (notificationQueue) {
      this.notificationFunction.addEventSource(
        new lambdaEventSources.SqsEventSource(notificationQueue, {
          batchSize: 10, // Process up to 10 messages at once
          maxBatchingWindow: cdk.Duration.seconds(5), // Wait up to 5 seconds to batch messages
          reportBatchItemFailures: true, // Enable partial batch failure reporting
        })
      );
    }

    // IAM Policies and Roles

    // DynamoDB permissions for all functions
    const dynamoDbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: [table.tableArn, `${table.tableArn}/index/*`],
    });

    // Add DynamoDB permissions to all functions
    [this.authFunction, this.userFunction, this.orderFunction, this.notificationFunction].forEach(
      func => {
        func.addToRolePolicy(dynamoDbPolicy);
      }
    );

    // Cognito permissions for auth and user functions
    if (userPool) {
      const cognitoPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:ListUsers',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:GetUser',
        ],
        resources: [userPool.userPoolArn],
      });

      // Add Cognito permissions to auth and user functions
      this.authFunction.addToRolePolicy(cognitoPolicy);
      this.userFunction.addToRolePolicy(cognitoPolicy);
    }

    // EventBridge permissions for order function
    this.orderFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [
          `arn:aws:events:${this.region}:${this.account}:event-bus/${eventBusName || `serverless-events-${environment}`}`,
        ],
      })
    );

    // SQS permissions for notification function (automatically granted by SqsEventSource)
    // But we can add additional SQS permissions if needed
    this.notificationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [`arn:aws:sqs:${this.region}:${this.account}:*${environment}*`],
      })
    );

    // SES permissions for notification function (email sending)
    this.notificationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ses:SendEmail',
          'ses:SendRawEmail',
          'ses:SendBulkTemplatedEmail',
          'ses:SendTemplatedEmail',
        ],
        resources: ['*'], // SES resources are region-specific, * is commonly used
      })
    );

    // SNS permissions for notification function (SMS sending)
    this.notificationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'sns:GetSMSAttributes', 'sns:SetSMSAttributes'],
        resources: ['*'], // SNS SMS doesn't use specific topic ARNs
      })
    );

    // CloudWatch Logs permissions (automatically added by CDK but explicit for clarity)
    const cloudWatchLogsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${environment}-*`,
      ],
    });

    // X-Ray permissions for tracing
    const xrayPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
      resources: ['*'],
    });

    // Add CloudWatch and X-Ray permissions to all functions
    [this.authFunction, this.userFunction, this.orderFunction, this.notificationFunction].forEach(
      func => {
        func.addToRolePolicy(cloudWatchLogsPolicy);
        func.addToRolePolicy(xrayPolicy);
      }
    );

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
