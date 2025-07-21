'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.LambdaStack = void 0;
const cdk = __importStar(require('aws-cdk-lib'));
const lambda = __importStar(require('aws-cdk-lib/aws-lambda'));
const nodejs = __importStar(require('aws-cdk-lib/aws-lambda-nodejs'));
const iam = __importStar(require('aws-cdk-lib/aws-iam'));
class LambdaStack extends cdk.Stack {
  authFunction;
  userFunction;
  orderFunction;
  notificationFunction;
  constructor(scope, id, props) {
    super(scope, id, props);
    const environment = props.environment || 'dev';
    const { table } = props;
    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        TABLE_NAME: table.tableName,
        NODE_ENV: environment,
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
      description: 'Authentication and authorization service',
      environment: {
        ...commonLambdaProps.environment,
        JWT_SECRET_NAME: `${environment}/microservices/jwt-secret`,
        COGNITO_USER_POOL_ID: '', // Will be set by Cognito stack
        COGNITO_CLIENT_ID: '', // Will be set by Cognito stack
      },
    });
    // User Service Function
    this.userFunction = new nodejs.NodejsFunction(this, 'UserFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-user-service`,
      entry: '../packages/service-users/src/index.ts',
      description: 'User management service',
    });
    // Order Service Function
    this.orderFunction = new nodejs.NodejsFunction(this, 'OrderFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-order-service`,
      entry: '../packages/service-orders/src/index.ts',
      description: 'Order management service',
      environment: {
        ...commonLambdaProps.environment,
        EVENT_BUS_NAME: `${environment}-microservices-bus`,
      },
    });
    // Notification Service Function
    this.notificationFunction = new nodejs.NodejsFunction(this, 'NotificationFunction', {
      ...commonLambdaProps,
      functionName: `${environment}-notification-service`,
      entry: '../packages/service-notifications/src/index.ts',
      description: 'Event-driven notification service',
      environment: {
        ...commonLambdaProps.environment,
        SQS_QUEUE_URL: '', // Will be set by Events stack
      },
    });
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
    // Secrets Manager permissions for auth function
    this.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${environment}/microservices/*`,
        ],
      })
    );
    // EventBridge permissions for order function
    this.orderFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [
          `arn:aws:events:${this.region}:${this.account}:event-bus/${environment}-microservices-bus`,
        ],
      })
    );
    // SQS permissions for notification function
    this.notificationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [`arn:aws:sqs:${this.region}:${this.account}:${environment}-*`],
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
    // CloudWatch Alarms for monitoring
    this.createCloudWatchAlarms(environment);
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
    // Tags
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'ServerlessMicroservices');
    cdk.Tags.of(this).add('Component', 'Lambda');
  }
  createCloudWatchAlarms(environment) {
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
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsc0VBQXdEO0FBQ3hELHlEQUEyQztBQVMzQyxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QixZQUFZLENBQXdCO0lBQ3BDLFlBQVksQ0FBd0I7SUFDcEMsYUFBYSxDQUF3QjtJQUNyQyxvQkFBb0IsQ0FBd0I7SUFFNUQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUMvQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXhCLDhCQUE4QjtRQUM5QixNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTtZQUN4QyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxLQUFLLENBQUMsU0FBUztnQkFDM0IsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLFNBQVMsRUFBRSxXQUFXLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU07Z0JBQ25ELHVCQUF1QixFQUFFLDBCQUEwQjtnQkFDbkQsb0JBQW9CLEVBQUUsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxD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QUNoQyxDQUFDO2dCQUNGLFNBQVMsRUFBRSxLQUFLLEVBQUUsYUFBYTtnQkFDL0IsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO2FBQ3BFLENBQUMsQ0FBQztZQUVILGtCQUFrQjtZQUNsQixJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksZUFBZSxFQUFFO2dCQUN6RCxTQUFTLEVBQUUsR0FBRyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxvQkFBb0I7Z0JBQ25FLGdCQUFnQixFQUFFLDJCQUEyQixJQUFJLFVBQVU7Z0JBQzNELE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDO29CQUMzQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2dCQUNGLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsYUFBYTthQUNwRSxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxRRCxrQ0FrUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbm9kZWpzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgcmVhZG9ubHkgdGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXV0aEZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSB1c2VyRnVuY3Rpb246IG5vZGVqcy5Ob2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG9yZGVyRnVuY3Rpb246IG5vZGVqcy5Ob2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG5vdGlmaWNhdGlvbkZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQgfHwgJ2Rldic7XG4gICAgY29uc3QgeyB0YWJsZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBjb21tb25MYW1iZGFQcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgTk9ERV9FTlY6IGVudmlyb25tZW50LFxuICAgICAgICBMT0dfTEVWRUw6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnV0FSTicgOiAnSU5GTycsXG4gICAgICAgIFBPV0VSVE9PTFNfU0VSVklDRV9OQU1FOiAnc2VydmVybGVzcy1taWNyb3NlcnZpY2VzJyxcbiAgICAgICAgUE9XRVJUT09MU19MT0dfTEVWRUw6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnV0FSTicgOiAnSU5GTycsXG4gICAgICAgIFBPV0VSVE9PTFNfTE9HR0VSX1NBTVBMRV9SQVRFOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzAuMScgOiAnMScsXG4gICAgICAgIFBPV0VSVE9PTFNfVFJBQ0VSX0NBUFRVUkVfUkVTUE9OU0U6ICd0cnVlJyxcbiAgICAgICAgUE9XRVJUT09MU19UUkFDRVJfQ0FQVFVSRV9FUlJPUjogJ3RydWUnLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICAgIGRlcHNMb2NrRmlsZVBhdGg6ICcuLi9wbnBtLWxvY2sueWFtbCcsXG4gICAgfTtcblxuICAgIC8vIEF1dGggU2VydmljZSBGdW5jdGlvblxuICAgIHRoaXMuYXV0aEZ1bmN0aW9uID0gbmV3IG5vZGVqcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnQXV0aEZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS1hdXRoLXNlcnZpY2VgLFxuICAgICAgZW50cnk6ICcuLi9wYWNrYWdlcy9zZXJ2aWNlLWF1dGgvc3JjL2luZGV4LnRzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXV0aGVudGljYXRpb24gYW5kIGF1dGhvcml6YXRpb24gc2VydmljZScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgSldUX1NFQ1JFVF9OQU1FOiBgJHtlbnZpcm9ubWVudH0vbWljcm9zZXJ2aWNlcy9qd3Qtc2VjcmV0YCxcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6ICcnLCAvLyBXaWxsIGJlIHNldCBieSBDb2duaXRvIHN0YWNrXG4gICAgICAgIENPR05JVE9fQ0xJRU5UX0lEOiAnJywgLy8gV2lsbCBiZSBzZXQgYnkgQ29nbml0byBzdGFja1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgU2VydmljZSBGdW5jdGlvblxuICAgIHRoaXMudXNlckZ1bmN0aW9uID0gbmV3IG5vZGVqcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnVXNlckZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS11c2VyLXNlcnZpY2VgLFxuICAgICAgZW50cnk6ICcuLi9wYWNrYWdlcy9zZXJ2aWNlLXVzZXJzL3NyYy9pbmRleC50cycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgbWFuYWdlbWVudCBzZXJ2aWNlJyxcbiAgICB9KTtcblxuICAgIC8vIE9yZGVyIFNlcnZpY2UgRnVuY3Rpb25cbiAgICB0aGlzLm9yZGVyRnVuY3Rpb24gPSBuZXcgbm9kZWpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdPcmRlckZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS1vcmRlci1zZXJ2aWNlYCxcbiAgICAgIGVudHJ5OiAnLi4vcGFja2FnZXMvc2VydmljZS1vcmRlcnMvc3JjL2luZGV4LnRzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3JkZXIgbWFuYWdlbWVudCBzZXJ2aWNlJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogYCR7ZW52aXJvbm1lbnR9LW1pY3Jvc2VydmljZXMtYnVzYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBOb3RpZmljYXRpb24gU2VydmljZSBGdW5jdGlvblxuICAgIHRoaXMubm90aWZpY2F0aW9uRnVuY3Rpb24gPSBuZXcgbm9kZWpzLk5vZGVqc0Z1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdOb3RpZmljYXRpb25GdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS1ub3RpZmljYXRpb24tc2VydmljZWAsXG4gICAgICAgIGVudHJ5OiAnLi4vcGFja2FnZXMvc2VydmljZS1ub3RpZmljYXRpb25zL3NyYy9pbmRleC50cycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRXZlbnQtZHJpdmVuIG5vdGlmaWNhdGlvbiBzZXJ2aWNlJyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICBTUVNfUVVFVUVfVVJMOiAnJywgLy8gV2lsbCBiZSBzZXQgYnkgRXZlbnRzIHN0YWNrXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIElBTSBQb2xpY2llcyBhbmQgUm9sZXNcblxuICAgIC8vIER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBhbGwgZnVuY3Rpb25zXG4gICAgY29uc3QgZHluYW1vRGJQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0YWJsZS50YWJsZUFybiwgYCR7dGFibGUudGFibGVBcm59L2luZGV4LypgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBEeW5hbW9EQiBwZXJtaXNzaW9ucyB0byBhbGwgZnVuY3Rpb25zXG4gICAgW1xuICAgICAgdGhpcy5hdXRoRnVuY3Rpb24sXG4gICAgICB0aGlzLnVzZXJGdW5jdGlvbixcbiAgICAgIHRoaXMub3JkZXJGdW5jdGlvbixcbiAgICAgIHRoaXMubm90aWZpY2F0aW9uRnVuY3Rpb24sXG4gICAgXS5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3koZHluYW1vRGJQb2xpY3kpO1xuICAgIH0pO1xuXG4gICAgLy8gU2VjcmV0cyBNYW5hZ2VyIHBlcm1pc3Npb25zIGZvciBhdXRoIGZ1bmN0aW9uXG4gICAgdGhpcy5hdXRoRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6c2VjcmV0c21hbmFnZXI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnNlY3JldDoke2Vudmlyb25tZW50fS9taWNyb3NlcnZpY2VzLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgcGVybWlzc2lvbnMgZm9yIG9yZGVyIGZ1bmN0aW9uXG4gICAgdGhpcy5vcmRlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6ZXZlbnRzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpldmVudC1idXMvJHtlbnZpcm9ubWVudH0tbWljcm9zZXJ2aWNlcy1idXNgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU1FTIHBlcm1pc3Npb25zIGZvciBub3RpZmljYXRpb24gZnVuY3Rpb25cbiAgICB0aGlzLm5vdGlmaWNhdGlvbkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NxczpSZWNlaXZlTWVzc2FnZScsXG4gICAgICAgICAgJ3NxczpEZWxldGVNZXNzYWdlJyxcbiAgICAgICAgICAnc3FzOkdldFF1ZXVlQXR0cmlidXRlcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOnNxczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHtlbnZpcm9ubWVudH0tKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnMgKGF1dG9tYXRpY2FsbHkgYWRkZWQgYnkgQ0RLIGJ1dCBleHBsaWNpdCBmb3IgY2xhcml0eSlcbiAgICBjb25zdCBjbG91ZFdhdGNoTG9nc1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9sYW1iZGEvJHtlbnZpcm9ubWVudH0tKmAsXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gWC1SYXkgcGVybWlzc2lvbnMgZm9yIHRyYWNpbmdcbiAgICBjb25zdCB4cmF5UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWyd4cmF5OlB1dFRyYWNlU2VnbWVudHMnLCAneHJheTpQdXRUZWxlbWV0cnlSZWNvcmRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIENsb3VkV2F0Y2ggYW5kIFgtUmF5IHBlcm1pc3Npb25zIHRvIGFsbCBmdW5jdGlvbnNcbiAgICBbXG4gICAgICB0aGlzLmF1dGhGdW5jdGlvbixcbiAgICAgIHRoaXMudXNlckZ1bmN0aW9uLFxuICAgICAgdGhpcy5vcmRlckZ1bmN0aW9uLFxuICAgICAgdGhpcy5ub3RpZmljYXRpb25GdW5jdGlvbixcbiAgICBdLmZvckVhY2goZnVuYyA9PiB7XG4gICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeShjbG91ZFdhdGNoTG9nc1BvbGljeSk7XG4gICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeSh4cmF5UG9saWN5KTtcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm1zIGZvciBtb25pdG9yaW5nXG4gICAgdGhpcy5jcmVhdGVDbG91ZFdhdGNoQWxhcm1zKGVudmlyb25tZW50KTtcblxuICAgIC8vIE91dHB1dHMgZm9yIG90aGVyIHN0YWNrc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXRoRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXRoRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1dGggc2VydmljZSBMYW1iZGEgZnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hdXRoLWZ1bmN0aW9uLWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlckZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIHNlcnZpY2UgTGFtYmRhIGZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tdXNlci1mdW5jdGlvbi1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09yZGVyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vcmRlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdPcmRlciBzZXJ2aWNlIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LW9yZGVyLWZ1bmN0aW9uLWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTm90aWZpY2F0aW9uRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ub3RpZmljYXRpb25GdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm90aWZpY2F0aW9uIHNlcnZpY2UgTGFtYmRhIGZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbm90aWZpY2F0aW9uLWZ1bmN0aW9uLWFybmAsXG4gICAgfSk7XG5cbiAgICAvLyBUYWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnU2VydmVybGVzc01pY3Jvc2VydmljZXMnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdMYW1iZGEnKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcyhlbnZpcm9ubWVudDogc3RyaW5nKSB7XG4gICAgY29uc3QgZnVuY3Rpb25zID0gW1xuICAgICAgeyBmdW5jOiB0aGlzLmF1dGhGdW5jdGlvbiwgbmFtZTogJ0F1dGgnIH0sXG4gICAgICB7IGZ1bmM6IHRoaXMudXNlckZ1bmN0aW9uLCBuYW1lOiAnVXNlcicgfSxcbiAgICAgIHsgZnVuYzogdGhpcy5vcmRlckZ1bmN0aW9uLCBuYW1lOiAnT3JkZXInIH0sXG4gICAgICB7IGZ1bmM6IHRoaXMubm90aWZpY2F0aW9uRnVuY3Rpb24sIG5hbWU6ICdOb3RpZmljYXRpb24nIH0sXG4gICAgXTtcblxuICAgIGZ1bmN0aW9ucy5mb3JFYWNoKCh7IGZ1bmMsIG5hbWUgfSkgPT4ge1xuICAgICAgLy8gRXJyb3IgcmF0ZSBhbGFybVxuICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgJHtuYW1lfUVycm9yQWxhcm1gLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7ZW52aXJvbm1lbnR9LSR7bmFtZS50b0xvd2VyQ2FzZSgpfS1zZXJ2aWNlLWVycm9yc2AsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBIaWdoIGVycm9yIHJhdGUgZm9yICR7bmFtZX0gc2VydmljZWAsXG4gICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNFcnJvcnMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIER1cmF0aW9uIGFsYXJtXG4gICAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGAke25hbWV9RHVyYXRpb25BbGFybWAsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtlbnZpcm9ubWVudH0tJHtuYW1lLnRvTG93ZXJDYXNlKCl9LXNlcnZpY2UtZHVyYXRpb25gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgSGlnaCBkdXJhdGlvbiBmb3IgJHtuYW1lfSBzZXJ2aWNlYCxcbiAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY0R1cmF0aW9uKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxMDAwMCwgLy8gMTAgc2Vjb25kc1xuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUaHJvdHRsZXMgYWxhcm1cbiAgICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgYCR7bmFtZX1UaHJvdHRsZUFsYXJtYCwge1xuICAgICAgICBhbGFybU5hbWU6IGAke2Vudmlyb25tZW50fS0ke25hbWUudG9Mb3dlckNhc2UoKX0tc2VydmljZS10aHJvdHRsZXNgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgVGhyb3R0bGluZyBkZXRlY3RlZCBmb3IgJHtuYW1lfSBzZXJ2aWNlYCxcbiAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY1Rocm90dGxlcyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNkay5hd3NfY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIl19
