import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface BaseLambdaFunctionProps {
  readonly environment: string;
  readonly config: EnvironmentConfig;
  readonly functionName: string;
  readonly entry: string;
  readonly description: string;
  readonly handler?: string;
  readonly timeout?: cdk.Duration;
  readonly memorySize?: number;
  readonly additionalEnvironmentVars?: { [key: string]: string };
}

export class BaseLambdaFunction extends nodejs.NodejsFunction {
  constructor(scope: Construct, id: string, props: BaseLambdaFunctionProps) {
    const { environment, config, functionName, entry, description, handler, timeout, memorySize, additionalEnvironmentVars = {} } = props;

    // CloudWatch Logs retention from config
    const logRetention = config.lambda.logRetentionDays;

    // Common environment variables
    const commonEnvironmentVars = {
      TABLE_NAME: config.dynamodb.tableName,
      NODE_ENV: config.lambda.nodeEnv,
      LOG_LEVEL: config.lambda.logLevel,
      POWERTOOLS_SERVICE_NAME: 'serverless-microservices',
      POWERTOOLS_LOG_LEVEL: config.lambda.powertoolsLogLevel,
      POWERTOOLS_LOGGER_SAMPLE_RATE: config.lambda.powertoolsLoggerSampleRate,
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
      POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
      ...additionalEnvironmentVars,
    };

    super(scope, id, {
      functionName,
      entry,
      handler,
      description,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: timeout || config.lambda.timeout,
      memorySize: memorySize || config.lambda.memorySize,
      environment: commonEnvironmentVars,
      tracing: lambda.Tracing.ACTIVE,
      depsLockFilePath: '../pnpm-lock.yaml',
      logGroup: new logs.LogGroup(scope, `${id}LogGroup`, {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Add common policies
    this.addCommonPolicies(environment);
  }

  private addCommonPolicies(environment: string) {
    // CloudWatch Logs permissions (CDK auto-adds this, but being explicit for consistency)
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/${environment}-*`,
        ],
      })
    );
    // Note: X-Ray permissions are automatically added by CDK when tracing: ACTIVE is set
  }

  public addDynamoDbPermissions(tableArn: string) {
    this.addToRolePolicy(
      new iam.PolicyStatement({
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
        resources: [tableArn, `${tableArn}/index/*`],
      })
    );
  }
}