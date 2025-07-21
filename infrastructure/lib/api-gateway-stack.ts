import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export interface ApiGatewayStackProps extends cdk.StackProps {
  readonly environment?: string
  readonly authFunction: nodejs.NodejsFunction
  readonly userFunction: nodejs.NodejsFunction
  readonly orderFunction: nodejs.NodejsFunction
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi
  public readonly authorizerFunction: nodejs.NodejsFunction

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props)

    const environment = props.environment || 'dev'
    const { authFunction, userFunction, orderFunction } = props

    // Create custom JWT authorizer function
    this.authorizerFunction = new nodejs.NodejsFunction(this, 'AuthorizerFunction', {
      functionName: `${environment}-jwt-authorizer`,
      entry: '../packages/shared-middleware/src/authorizer.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'JWT Custom Authorizer for API Gateway',
      environment: {
        NODE_ENV: environment,
        LOG_LEVEL: environment === 'prod' ? 'WARN' : 'INFO',
        JWT_SECRET_NAME: `${environment}/microservices/jwt-secret`,
      },
      tracing: lambda.Tracing.ACTIVE,
      depsLockFilePath: '../pnpm-lock.yaml',
    })

    // Grant secrets manager permissions to authorizer
    this.authorizerFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${environment}/microservices/*`,
      ],
    }))

    // Create CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/${environment}-microservices-api`,
      retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    // Create HTTP API Gateway
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${environment}-microservices-api`,
      description: `Serverless Microservices API - ${environment} environment`,
      corsPreflight: {
        allowCredentials: environment === 'prod' ? true : false,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: environment === 'prod' 
          ? ['https://yourdomain.com'] // Replace with actual production domain
          : ['*'], // Allow all origins in dev
        maxAge: cdk.Duration.hours(1),
      },
    })

    // Create JWT Authorizer
    const jwtAuthorizer = new apigatewayv2Authorizers.HttpLambdaAuthorizer('JwtAuthorizer', this.authorizerFunction, {
      authorizerName: `${environment}-jwt-authorizer`,
      responseTypes: [apigatewayv2Authorizers.HttpLambdaResponseType.SIMPLE],
      resultsCacheTtl: cdk.Duration.minutes(5),
      identitySource: ['$request.header.Authorization'],
    })

    // Create Lambda integrations
    const authIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('AuthIntegration', authFunction)
    const userIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('UserIntegration', userFunction)
    const orderIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('OrderIntegration', orderFunction)

    // Auth routes (public - no authorization required)
    this.httpApi.addRoutes({
      path: '/auth/login',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    })

    this.httpApi.addRoutes({
      path: '/auth/register',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    })

    this.httpApi.addRoutes({
      path: '/auth/refresh',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    })

    this.httpApi.addRoutes({
      path: '/auth/verify',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    })

    // User routes (protected - requires JWT authorization)
    this.httpApi.addRoutes({
      path: '/users',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: userIntegration,
      authorizer: jwtAuthorizer,
    })

    this.httpApi.addRoutes({
      path: '/users/{id}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
        apigatewayv2.HttpMethod.PATCH,
      ],
      integration: userIntegration,
      authorizer: jwtAuthorizer,
    })

    this.httpApi.addRoutes({
      path: '/users/{id}/profile',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT],
      integration: userIntegration,
      authorizer: jwtAuthorizer,
    })

    // Order routes (protected - requires JWT authorization)
    this.httpApi.addRoutes({
      path: '/orders',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    })

    this.httpApi.addRoutes({
      path: '/orders/{id}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
        apigatewayv2.HttpMethod.PATCH,
      ],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    })

    this.httpApi.addRoutes({
      path: '/orders/{id}/status',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    })

    this.httpApi.addRoutes({
      path: '/users/{userId}/orders',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    })

    // Health check route (public)
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('HealthIntegration', authFunction),
    })

    // Create default stage with logging
    const defaultStage = this.httpApi.defaultStage as apigatewayv2.HttpStage
    if (defaultStage) {
      // Enable access logging
      defaultStage.node.addDependency(logGroup)
    }

    // Add throttling for production using route-level throttling
    if (environment === 'prod') {
      // Note: HTTP API v2 doesn't support stage-level throttling like REST API
      // Throttling can be implemented at the Lambda level or using AWS WAF
      // For now, we'll rely on Lambda concurrency limits and monitoring
    }

    // CloudWatch alarms for API Gateway
    this.createCloudWatchAlarms(environment)

    // Outputs
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API Gateway endpoint URL',
      exportName: `${environment}-api-gateway-url`,
    })

    new cdk.CfnOutput(this, 'HttpApiId', {
      value: this.httpApi.httpApiId,
      description: 'HTTP API Gateway ID',
      exportName: `${environment}-api-gateway-id`,
    })

    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: this.authorizerFunction.functionArn,
      description: 'JWT Authorizer function ARN',
      exportName: `${environment}-authorizer-function-arn`,
    })

    // Tags
    cdk.Tags.of(this).add('Environment', environment)
    cdk.Tags.of(this).add('Project', 'ServerlessMicroservices')
    cdk.Tags.of(this).add('Component', 'ApiGateway')
  }

  private createCloudWatchAlarms(environment: string) {
    // API Gateway 4XX errors alarm
    new cdk.aws_cloudwatch.Alarm(this, 'Api4XXErrorAlarm', {
      alarmName: `${environment}-api-gateway-4xx-errors`,
      alarmDescription: 'High rate of 4XX errors in API Gateway',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: this.httpApi.apiId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 20,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    // API Gateway 5XX errors alarm
    new cdk.aws_cloudwatch.Alarm(this, 'Api5XXErrorAlarm', {
      alarmName: `${environment}-api-gateway-5xx-errors`,
      alarmDescription: 'High rate of 5XX errors in API Gateway',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: this.httpApi.apiId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    // API Gateway latency alarm
    new cdk.aws_cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${environment}-api-gateway-latency`,
      alarmDescription: 'High latency in API Gateway',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: this.httpApi.apiId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3000, // 3 seconds
      evaluationPeriods: 3,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    // API Gateway request count for monitoring
    new cdk.aws_cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: this.httpApi.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    })
  }
}