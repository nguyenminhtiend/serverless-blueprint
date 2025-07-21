"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const nodejs = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
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
            bundling: {
                minify: true,
                sourceMap: true,
                target: 'es2022',
                format: nodejs.OutputFormat.ESM,
                mainFields: ['module', 'main'],
                externalModules: [
                    '@aws-sdk/client-dynamodb',
                    '@aws-sdk/lib-dynamodb',
                    '@aws-sdk/client-eventbridge',
                    '@aws-sdk/client-sqs',
                ],
                banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
            },
            tracing: lambda.Tracing.ACTIVE,
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
            resources: [
                table.tableArn,
                `${table.tableArn}/index/*`,
            ],
        });
        [this.authFunction, this.userFunction, this.orderFunction, this.notificationFunction].forEach(func => {
            func.addToRolePolicy(dynamoDbPolicy);
        });
        // Secrets Manager permissions for auth function
        this.authFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'secretsmanager:GetSecretValue',
            ],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${environment}/microservices/*`,
            ],
        }));
        // EventBridge permissions for order function
        this.orderFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'events:PutEvents',
            ],
            resources: [
                `arn:aws:events:${this.region}:${this.account}:event-bus/${environment}-microservices-bus`,
            ],
        }));
        // SQS permissions for notification function
        this.notificationFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: [
                `arn:aws:sqs:${this.region}:${this.account}:${environment}-*`,
            ],
        }));
        // CloudWatch Logs permissions (automatically added by CDK but explicit for clarity)
        const cloudWatchLogsPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${environment}-*`,
            ],
        });
        // X-Ray permissions for tracing
        const xrayPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
            ],
            resources: ['*'],
        });
        [this.authFunction, this.userFunction, this.orderFunction, this.notificationFunction].forEach(func => {
            func.addToRolePolicy(cloudWatchLogsPolicy);
            func.addToRolePolicy(xrayPolicy);
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFrQztBQUNsQywrREFBZ0Q7QUFDaEQsc0VBQXVEO0FBQ3ZELHlEQUEwQztBQVMxQyxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QixZQUFZLENBQXVCO0lBQ25DLFlBQVksQ0FBdUI7SUFDbkMsYUFBYSxDQUF1QjtJQUNwQyxvQkFBb0IsQ0FBdUI7SUFFM0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUV2QixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQTtRQUM5QyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFBO1FBRXZCLDhCQUE4QjtRQUM5QixNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTtZQUN4QyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxLQUFLLENBQUMsU0FBUztnQkFDM0IsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLFNBQVMsRUFBRSxXQUFXLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU07Z0JBQ25ELHVCQUF1QixFQUFFLDBCQUEwQjtnQkFDbkQsb0JBQW9CLEVBQUUsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxD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RUFBRSxHQUFHLElBQUksZUFBZSxFQUFFO2dCQUN6RCxTQUFTLEVBQUUsR0FBRyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxtQkFBbUI7Z0JBQ2xFLGdCQUFnQixFQUFFLHFCQUFxQixJQUFJLFVBQVU7Z0JBQ3JELE1BQU0sRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDO29CQUMxQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2dCQUNGLFNBQVMsRUFBRSxLQUFLLEVBQUUsYUFBYTtnQkFDL0IsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO2FBQ3BFLENBQUMsQ0FBQTtZQUVGLGtCQUFrQjtZQUNsQixJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksZUFBZSxFQUFFO2dCQUN6RCxTQUFTLEVBQUUsR0FBRyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxvQkFBb0I7Z0JBQ25FLGdCQUFnQixFQUFFLDJCQUEyQixJQUFJLFVBQVU7Z0JBQzNELE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDO29CQUMzQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2dCQUNGLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsYUFBYTthQUNwRSxDQUFDLENBQUE7UUFDSixDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQXJRRCxrQ0FxUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSdcbmltcG9ydCAqIGFzIG5vZGVqcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcydcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJ1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJ1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZ1xuICByZWFkb25seSB0YWJsZTogZHluYW1vZGIuVGFibGVcbn1cblxuZXhwb3J0IGNsYXNzIExhbWJkYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhGdW5jdGlvbjogbm9kZWpzLk5vZGVqc0Z1bmN0aW9uXG4gIHB1YmxpYyByZWFkb25seSB1c2VyRnVuY3Rpb246IG5vZGVqcy5Ob2RlanNGdW5jdGlvblxuICBwdWJsaWMgcmVhZG9ubHkgb3JkZXJGdW5jdGlvbjogbm9kZWpzLk5vZGVqc0Z1bmN0aW9uXG4gIHB1YmxpYyByZWFkb25seSBub3RpZmljYXRpb25GdW5jdGlvbjogbm9kZWpzLk5vZGVqc0Z1bmN0aW9uXG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKVxuXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBwcm9wcy5lbnZpcm9ubWVudCB8fCAnZGV2J1xuICAgIGNvbnN0IHsgdGFibGUgfSA9IHByb3BzXG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBjb21tb25MYW1iZGFQcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgTk9ERV9FTlY6IGVudmlyb25tZW50LFxuICAgICAgICBMT0dfTEVWRUw6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnV0FSTicgOiAnSU5GTycsXG4gICAgICAgIFBPV0VSVE9PTFNfU0VSVklDRV9OQU1FOiAnc2VydmVybGVzcy1taWNyb3NlcnZpY2VzJyxcbiAgICAgICAgUE9XRVJUT09MU19MT0dfTEVWRUw6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnV0FSTicgOiAnSU5GTycsXG4gICAgICAgIFBPV0VSVE9PTFNfTE9HR0VSX1NBTVBMRV9SQVRFOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzAuMScgOiAnMScsXG4gICAgICAgIFBPV0VSVE9PTFNfVFJBQ0VSX0NBUFRVUkVfUkVTUE9OU0U6ICd0cnVlJyxcbiAgICAgICAgUE9XRVJUT09MU19UUkFDRVJfQ0FQVFVSRV9FUlJPUjogJ3RydWUnLFxuICAgICAgfSxcbiAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICB0YXJnZXQ6ICdlczIwMjInLFxuICAgICAgICBmb3JtYXQ6IG5vZGVqcy5PdXRwdXRGb3JtYXQuRVNNLFxuICAgICAgICBtYWluRmllbGRzOiBbJ21vZHVsZScsICdtYWluJ10sXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogW1xuICAgICAgICAgICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInLFxuICAgICAgICAgICdAYXdzLXNkay9saWItZHluYW1vZGInLFxuICAgICAgICAgICdAYXdzLXNkay9jbGllbnQtZXZlbnRicmlkZ2UnLFxuICAgICAgICAgICdAYXdzLXNkay9jbGllbnQtc3FzJyxcbiAgICAgICAgXSxcbiAgICAgICAgYmFubmVyOiBcImltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdtb2R1bGUnOyBjb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1wiLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9XG5cbiAgICAvLyBBdXRoIFNlcnZpY2UgRnVuY3Rpb25cbiAgICB0aGlzLmF1dGhGdW5jdGlvbiA9IG5ldyBub2RlanMuTm9kZWpzRnVuY3Rpb24odGhpcywgJ0F1dGhGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtlbnZpcm9ubWVudH0tYXV0aC1zZXJ2aWNlYCxcbiAgICAgIGVudHJ5OiAnLi4vcGFja2FnZXMvc2VydmljZS1hdXRoL3NyYy9pbmRleC50cycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1dGhlbnRpY2F0aW9uIGFuZCBhdXRob3JpemF0aW9uIHNlcnZpY2UnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIEpXVF9TRUNSRVRfTkFNRTogYCR7ZW52aXJvbm1lbnR9L21pY3Jvc2VydmljZXMvand0LXNlY3JldGAsXG4gICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiAnJywgLy8gV2lsbCBiZSBzZXQgYnkgQ29nbml0byBzdGFja1xuICAgICAgICBDT0dOSVRPX0NMSUVOVF9JRDogJycsIC8vIFdpbGwgYmUgc2V0IGJ5IENvZ25pdG8gc3RhY2tcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIFVzZXIgU2VydmljZSBGdW5jdGlvblxuICAgIHRoaXMudXNlckZ1bmN0aW9uID0gbmV3IG5vZGVqcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnVXNlckZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS11c2VyLXNlcnZpY2VgLFxuICAgICAgZW50cnk6ICcuLi9wYWNrYWdlcy9zZXJ2aWNlLXVzZXJzL3NyYy9pbmRleC50cycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgbWFuYWdlbWVudCBzZXJ2aWNlJyxcbiAgICB9KVxuXG4gICAgLy8gT3JkZXIgU2VydmljZSBGdW5jdGlvblxuICAgIHRoaXMub3JkZXJGdW5jdGlvbiA9IG5ldyBub2RlanMuTm9kZWpzRnVuY3Rpb24odGhpcywgJ09yZGVyRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7ZW52aXJvbm1lbnR9LW9yZGVyLXNlcnZpY2VgLFxuICAgICAgZW50cnk6ICcuLi9wYWNrYWdlcy9zZXJ2aWNlLW9yZGVycy9zcmMvaW5kZXgudHMnLFxuICAgICAgZGVzY3JpcHRpb246ICdPcmRlciBtYW5hZ2VtZW50IHNlcnZpY2UnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIEVWRU5UX0JVU19OQU1FOiBgJHtlbnZpcm9ubWVudH0tbWljcm9zZXJ2aWNlcy1idXNgLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gTm90aWZpY2F0aW9uIFNlcnZpY2UgRnVuY3Rpb25cbiAgICB0aGlzLm5vdGlmaWNhdGlvbkZ1bmN0aW9uID0gbmV3IG5vZGVqcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnTm90aWZpY2F0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7ZW52aXJvbm1lbnR9LW5vdGlmaWNhdGlvbi1zZXJ2aWNlYCxcbiAgICAgIGVudHJ5OiAnLi4vcGFja2FnZXMvc2VydmljZS1ub3RpZmljYXRpb25zL3NyYy9pbmRleC50cycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50LWRyaXZlbiBub3RpZmljYXRpb24gc2VydmljZScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgU1FTX1FVRVVFX1VSTDogJycsIC8vIFdpbGwgYmUgc2V0IGJ5IEV2ZW50cyBzdGFja1xuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gSUFNIFBvbGljaWVzIGFuZCBSb2xlc1xuXG4gICAgLy8gRHluYW1vREIgcGVybWlzc2lvbnMgZm9yIGFsbCBmdW5jdGlvbnNcbiAgICBjb25zdCBkeW5hbW9EYlBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICdkeW5hbW9kYjpCYXRjaEdldEl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICB0YWJsZS50YWJsZUFybixcbiAgICAgICAgYCR7dGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgXSxcbiAgICB9KVxuXG4gICAgLy8gQWRkIER5bmFtb0RCIHBlcm1pc3Npb25zIHRvIGFsbCBmdW5jdGlvbnNcbiAgICA7W3RoaXMuYXV0aEZ1bmN0aW9uLCB0aGlzLnVzZXJGdW5jdGlvbiwgdGhpcy5vcmRlckZ1bmN0aW9uLCB0aGlzLm5vdGlmaWNhdGlvbkZ1bmN0aW9uXS5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3koZHluYW1vRGJQb2xpY3kpXG4gICAgfSlcblxuICAgIC8vIFNlY3JldHMgTWFuYWdlciBwZXJtaXNzaW9ucyBmb3IgYXV0aCBmdW5jdGlvblxuICAgIHRoaXMuYXV0aEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzZWNyZXQ6JHtlbnZpcm9ubWVudH0vbWljcm9zZXJ2aWNlcy8qYCxcbiAgICAgIF0sXG4gICAgfSkpXG5cbiAgICAvLyBFdmVudEJyaWRnZSBwZXJtaXNzaW9ucyBmb3Igb3JkZXIgZnVuY3Rpb25cbiAgICB0aGlzLm9yZGVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2V2ZW50czpQdXRFdmVudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpldmVudHM6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmV2ZW50LWJ1cy8ke2Vudmlyb25tZW50fS1taWNyb3NlcnZpY2VzLWJ1c2AsXG4gICAgICBdLFxuICAgIH0pKVxuXG4gICAgLy8gU1FTIHBlcm1pc3Npb25zIGZvciBub3RpZmljYXRpb24gZnVuY3Rpb25cbiAgICB0aGlzLm5vdGlmaWNhdGlvbkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzcXM6UmVjZWl2ZU1lc3NhZ2UnLFxuICAgICAgICAnc3FzOkRlbGV0ZU1lc3NhZ2UnLFxuICAgICAgICAnc3FzOkdldFF1ZXVlQXR0cmlidXRlcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNxczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHtlbnZpcm9ubWVudH0tKmAsXG4gICAgICBdLFxuICAgIH0pKVxuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzIHBlcm1pc3Npb25zIChhdXRvbWF0aWNhbGx5IGFkZGVkIGJ5IENESyBidXQgZXhwbGljaXQgZm9yIGNsYXJpdHkpXG4gICAgY29uc3QgY2xvdWRXYXRjaExvZ3NQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLyR7ZW52aXJvbm1lbnR9LSpgLFxuICAgICAgXSxcbiAgICB9KVxuXG4gICAgLy8gWC1SYXkgcGVybWlzc2lvbnMgZm9yIHRyYWNpbmdcbiAgICBjb25zdCB4cmF5UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAneHJheTpQdXRUcmFjZVNlZ21lbnRzJyxcbiAgICAgICAgJ3hyYXk6UHV0VGVsZW1ldHJ5UmVjb3JkcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KVxuXG4gICAgLy8gQWRkIENsb3VkV2F0Y2ggYW5kIFgtUmF5IHBlcm1pc3Npb25zIHRvIGFsbCBmdW5jdGlvbnNcbiAgICA7W3RoaXMuYXV0aEZ1bmN0aW9uLCB0aGlzLnVzZXJGdW5jdGlvbiwgdGhpcy5vcmRlckZ1bmN0aW9uLCB0aGlzLm5vdGlmaWNhdGlvbkZ1bmN0aW9uXS5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3koY2xvdWRXYXRjaExvZ3NQb2xpY3kpXG4gICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeSh4cmF5UG9saWN5KVxuICAgIH0pXG5cbiAgICAvLyBDbG91ZFdhdGNoIEFsYXJtcyBmb3IgbW9uaXRvcmluZ1xuICAgIHRoaXMuY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcyhlbnZpcm9ubWVudClcblxuICAgIC8vIE91dHB1dHMgZm9yIG90aGVyIHN0YWNrc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXRoRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXRoRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1dGggc2VydmljZSBMYW1iZGEgZnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hdXRoLWZ1bmN0aW9uLWFybmAsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgc2VydmljZSBMYW1iZGEgZnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS11c2VyLWZ1bmN0aW9uLWFybmAsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcmRlckZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMub3JkZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3JkZXIgc2VydmljZSBMYW1iZGEgZnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1vcmRlci1mdW5jdGlvbi1hcm5gLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTm90aWZpY2F0aW9uRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ub3RpZmljYXRpb25GdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm90aWZpY2F0aW9uIHNlcnZpY2UgTGFtYmRhIGZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbm90aWZpY2F0aW9uLWZ1bmN0aW9uLWFybmAsXG4gICAgfSlcblxuICAgIC8vIFRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnQpXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ1NlcnZlcmxlc3NNaWNyb3NlcnZpY2VzJylcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdMYW1iZGEnKVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVDbG91ZFdhdGNoQWxhcm1zKGVudmlyb25tZW50OiBzdHJpbmcpIHtcbiAgICBjb25zdCBmdW5jdGlvbnMgPSBbXG4gICAgICB7IGZ1bmM6IHRoaXMuYXV0aEZ1bmN0aW9uLCBuYW1lOiAnQXV0aCcgfSxcbiAgICAgIHsgZnVuYzogdGhpcy51c2VyRnVuY3Rpb24sIG5hbWU6ICdVc2VyJyB9LFxuICAgICAgeyBmdW5jOiB0aGlzLm9yZGVyRnVuY3Rpb24sIG5hbWU6ICdPcmRlcicgfSxcbiAgICAgIHsgZnVuYzogdGhpcy5ub3RpZmljYXRpb25GdW5jdGlvbiwgbmFtZTogJ05vdGlmaWNhdGlvbicgfSxcbiAgICBdXG5cbiAgICBmdW5jdGlvbnMuZm9yRWFjaCgoeyBmdW5jLCBuYW1lIH0pID0+IHtcbiAgICAgIC8vIEVycm9yIHJhdGUgYWxhcm1cbiAgICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgYCR7bmFtZX1FcnJvckFsYXJtYCwge1xuICAgICAgICBhbGFybU5hbWU6IGAke2Vudmlyb25tZW50fS0ke25hbWUudG9Mb3dlckNhc2UoKX0tc2VydmljZS1lcnJvcnNgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgSGlnaCBlcnJvciByYXRlIGZvciAke25hbWV9IHNlcnZpY2VgLFxuICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljRXJyb3JzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pXG5cbiAgICAgIC8vIER1cmF0aW9uIGFsYXJtXG4gICAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGAke25hbWV9RHVyYXRpb25BbGFybWAsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtlbnZpcm9ubWVudH0tJHtuYW1lLnRvTG93ZXJDYXNlKCl9LXNlcnZpY2UtZHVyYXRpb25gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgSGlnaCBkdXJhdGlvbiBmb3IgJHtuYW1lfSBzZXJ2aWNlYCxcbiAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY0R1cmF0aW9uKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxMDAwMCwgLy8gMTAgc2Vjb25kc1xuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pXG5cbiAgICAgIC8vIFRocm90dGxlcyBhbGFybVxuICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgJHtuYW1lfVRocm90dGxlQWxhcm1gLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7ZW52aXJvbm1lbnR9LSR7bmFtZS50b0xvd2VyQ2FzZSgpfS1zZXJ2aWNlLXRocm90dGxlc2AsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBUaHJvdHRsaW5nIGRldGVjdGVkIGZvciAke25hbWV9IHNlcnZpY2VgLFxuICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljVGhyb3R0bGVzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxufSJdfQ==