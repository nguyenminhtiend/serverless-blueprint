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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require('aws-cdk-lib'));
const apigatewayv2 = __importStar(require('aws-cdk-lib/aws-apigatewayv2'));
const apigatewayv2Integrations = __importStar(require('aws-cdk-lib/aws-apigatewayv2-integrations'));
const apigatewayv2Authorizers = __importStar(require('aws-cdk-lib/aws-apigatewayv2-authorizers'));
const lambda = __importStar(require('aws-cdk-lib/aws-lambda'));
const nodejs = __importStar(require('aws-cdk-lib/aws-lambda-nodejs'));
const logs = __importStar(require('aws-cdk-lib/aws-logs'));
class ApiGatewayStack extends cdk.Stack {
  httpApi;
  authorizerFunction;
  constructor(scope, id, props) {
    super(scope, id, props);
    const environment = props.environment || 'dev';
    const { authFunction, userFunction, orderFunction } = props;
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
    });
    // Grant secrets manager permissions to authorizer
    this.authorizerFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${environment}/microservices/*`,
        ],
      })
    );
    // Create CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/${environment}-microservices-api`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
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
        allowOrigins:
          environment === 'prod'
            ? ['https://yourdomain.com'] // Replace with actual production domain
            : ['*'], // Allow all origins in dev
        maxAge: cdk.Duration.hours(1),
      },
    });
    // Create JWT Authorizer
    const jwtAuthorizer = new apigatewayv2Authorizers.HttpLambdaAuthorizer(
      'JwtAuthorizer',
      this.authorizerFunction,
      {
        authorizerName: `${environment}-jwt-authorizer`,
        responseTypes: [apigatewayv2Authorizers.HttpLambdaResponseType.SIMPLE],
        resultsCacheTtl: cdk.Duration.minutes(5),
        identitySource: ['$request.header.Authorization'],
      }
    );
    // Create Lambda integrations
    const authIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'AuthIntegration',
      authFunction
    );
    const userIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'UserIntegration',
      userFunction
    );
    const orderIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'OrderIntegration',
      orderFunction
    );
    // Auth routes (public - no authorization required)
    this.httpApi.addRoutes({
      path: '/auth/login',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    });
    this.httpApi.addRoutes({
      path: '/auth/register',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    });
    this.httpApi.addRoutes({
      path: '/auth/refresh',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    });
    this.httpApi.addRoutes({
      path: '/auth/verify',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: authIntegration,
    });
    // User routes (protected - requires JWT authorization)
    this.httpApi.addRoutes({
      path: '/users',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: userIntegration,
      authorizer: jwtAuthorizer,
    });
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
    });
    this.httpApi.addRoutes({
      path: '/users/{id}/profile',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT],
      integration: userIntegration,
      authorizer: jwtAuthorizer,
    });
    // Order routes (protected - requires JWT authorization)
    this.httpApi.addRoutes({
      path: '/orders',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    });
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
    });
    this.httpApi.addRoutes({
      path: '/orders/{id}/status',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/users/{userId}/orders',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: orderIntegration,
      authorizer: jwtAuthorizer,
    });
    // Health check route (public)
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'HealthIntegration',
        authFunction
      ),
    });
    // Create default stage with logging
    const defaultStage = this.httpApi.defaultStage;
    if (defaultStage) {
      // Enable access logging
      defaultStage.node.addDependency(logGroup);
    }
    // Add throttling for production using route-level throttling
    if (environment === 'prod') {
      // Note: HTTP API v2 doesn't support stage-level throttling like REST API
      // Throttling can be implemented at the Lambda level or using AWS WAF
      // For now, we'll rely on Lambda concurrency limits and monitoring
    }
    // CloudWatch alarms for API Gateway
    this.createCloudWatchAlarms(environment);
    // Outputs
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API Gateway endpoint URL',
      exportName: `${environment}-api-gateway-url`,
    });
    new cdk.CfnOutput(this, 'HttpApiId', {
      value: this.httpApi.httpApiId,
      description: 'HTTP API Gateway ID',
      exportName: `${environment}-api-gateway-id`,
    });
    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: this.authorizerFunction.functionArn,
      description: 'JWT Authorizer function ARN',
      exportName: `${environment}-authorizer-function-arn`,
    });
    // Tags
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'ServerlessMicroservices');
    cdk.Tags.of(this).add('Component', 'ApiGateway');
  }
  createCloudWatchAlarms(environment) {
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
    });
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
    });
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
    });
    // API Gateway request count for monitoring
    new cdk.aws_cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: this.httpApi.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });
  }
}
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9hcGktZ2F0ZXdheS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMsMkVBQTREO0FBQzVELG9HQUFxRjtBQUNyRixrR0FBbUY7QUFDbkYsK0RBQWdEO0FBQ2hELHNFQUF1RDtBQUN2RCwyREFBNEM7QUFVNUMsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLE9BQU8sQ0FBc0I7SUFDN0Isa0JBQWtCLENBQXVCO0lBRXpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFFdkIsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUE7UUFDOUMsTUFBTSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEdBQUcsS0FBSyxDQUFBO1FBRTNELHdDQUF3QztRQUN4QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM5RSxZQUFZLEVBQUUsR0FBRyxXQUFXLGlCQUFpQjtZQUM3QyxLQUFLLEVBQUUsaURBQWlEO1lBQ3hELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTtZQUN4QyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxXQUFXLEVBQUU7Z0JBQ1gsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLFNBQVMsRUFBRSxX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QUM7Q0FDRjtBQXhSRCwwQ0F3UkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2MidcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MkludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucydcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MkF1dGhvcml6ZXJzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItYXV0aG9yaXplcnMnXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSdcbmltcG9ydCAqIGFzIG5vZGVqcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcydcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaUdhdGV3YXlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZ1xuICByZWFkb25seSBhdXRoRnVuY3Rpb246IG5vZGVqcy5Ob2RlanNGdW5jdGlvblxuICByZWFkb25seSB1c2VyRnVuY3Rpb246IG5vZGVqcy5Ob2RlanNGdW5jdGlvblxuICByZWFkb25seSBvcmRlckZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb25cbn1cblxuZXhwb3J0IGNsYXNzIEFwaUdhdGV3YXlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBodHRwQXBpOiBhcGlnYXRld2F5djIuSHR0cEFwaVxuICBwdWJsaWMgcmVhZG9ubHkgYXV0aG9yaXplckZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb25cblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpR2F0ZXdheVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKVxuXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBwcm9wcy5lbnZpcm9ubWVudCB8fCAnZGV2J1xuICAgIGNvbnN0IHsgYXV0aEZ1bmN0aW9uLCB1c2VyRnVuY3Rpb24sIG9yZGVyRnVuY3Rpb24gfSA9IHByb3BzXG5cbiAgICAvLyBDcmVhdGUgY3VzdG9tIEpXVCBhdXRob3JpemVyIGZ1bmN0aW9uXG4gICAgdGhpcy5hdXRob3JpemVyRnVuY3Rpb24gPSBuZXcgbm9kZWpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdBdXRob3JpemVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2Vudmlyb25tZW50fS1qd3QtYXV0aG9yaXplcmAsXG4gICAgICBlbnRyeTogJy4uL3BhY2thZ2VzL3NoYXJlZC1taWRkbGV3YXJlL3NyYy9hdXRob3JpemVyLnRzJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGRlc2NyaXB0aW9uOiAnSldUIEN1c3RvbSBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogZW52aXJvbm1lbnQsXG4gICAgICAgIExPR19MRVZFTDogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICdXQVJOJyA6ICdJTkZPJyxcbiAgICAgICAgSldUX1NFQ1JFVF9OQU1FOiBgJHtlbnZpcm9ubWVudH0vbWljcm9zZXJ2aWNlcy9qd3Qtc2VjcmV0YCxcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgICBkZXBzTG9ja0ZpbGVQYXRoOiAnLi4vcG5wbS1sb2NrLnlhbWwnLFxuICAgIH0pXG5cbiAgICAvLyBHcmFudCBzZWNyZXRzIG1hbmFnZXIgcGVybWlzc2lvbnMgdG8gYXV0aG9yaXplclxuICAgIHRoaXMuYXV0aG9yaXplckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogY2RrLmF3c19pYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZSddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzZWNyZXQ6JHtlbnZpcm9ubWVudH0vbWljcm9zZXJ2aWNlcy8qYCxcbiAgICAgIF0sXG4gICAgfSkpXG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIEFQSSBHYXRld2F5XG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQXBpR2F0ZXdheUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5LyR7ZW52aXJvbm1lbnR9LW1pY3Jvc2VydmljZXMtYXBpYCxcbiAgICAgIHJldGVudGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEggOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KVxuXG4gICAgLy8gQ3JlYXRlIEhUVFAgQVBJIEdhdGV3YXlcbiAgICB0aGlzLmh0dHBBcGkgPSBuZXcgYXBpZ2F0ZXdheXYyLkh0dHBBcGkodGhpcywgJ0h0dHBBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgJHtlbnZpcm9ubWVudH0tbWljcm9zZXJ2aWNlcy1hcGlgLFxuICAgICAgZGVzY3JpcHRpb246IGBTZXJ2ZXJsZXNzIE1pY3Jvc2VydmljZXMgQVBJIC0gJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgICAgY29yc1ByZWZsaWdodDoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gdHJ1ZSA6IGZhbHNlLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1SZXF1ZXN0ZWQtV2l0aCddLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFtcbiAgICAgICAgICBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuR0VULFxuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5QVVQsXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLkRFTEVURSxcbiAgICAgICAgICBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuUEFUQ0gsXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLk9QVElPTlMsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93T3JpZ2luczogZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IFsnaHR0cHM6Ly95b3VyZG9tYWluLmNvbSddIC8vIFJlcGxhY2Ugd2l0aCBhY3R1YWwgcHJvZHVjdGlvbiBkb21haW5cbiAgICAgICAgICA6IFsnKiddLCAvLyBBbGxvdyBhbGwgb3JpZ2lucyBpbiBkZXZcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBDcmVhdGUgSldUIEF1dGhvcml6ZXJcbiAgICBjb25zdCBqd3RBdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXl2MkF1dGhvcml6ZXJzLkh0dHBMYW1iZGFBdXRob3JpemVyKCdKd3RBdXRob3JpemVyJywgdGhpcy5hdXRob3JpemVyRnVuY3Rpb24sIHtcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiBgJHtlbnZpcm9ubWVudH0tand0LWF1dGhvcml6ZXJgLFxuICAgICAgcmVzcG9uc2VUeXBlczogW2FwaWdhdGV3YXl2MkF1dGhvcml6ZXJzLkh0dHBMYW1iZGFSZXNwb25zZVR5cGUuU0lNUExFXSxcbiAgICAgIHJlc3VsdHNDYWNoZVR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBpZGVudGl0eVNvdXJjZTogWyckcmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvbiddLFxuICAgIH0pXG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGludGVncmF0aW9uc1xuICAgIGNvbnN0IGF1dGhJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKCdBdXRoSW50ZWdyYXRpb24nLCBhdXRoRnVuY3Rpb24pXG4gICAgY29uc3QgdXNlckludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oJ1VzZXJJbnRlZ3JhdGlvbicsIHVzZXJGdW5jdGlvbilcbiAgICBjb25zdCBvcmRlckludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oJ09yZGVySW50ZWdyYXRpb24nLCBvcmRlckZ1bmN0aW9uKVxuXG4gICAgLy8gQXV0aCByb3V0ZXMgKHB1YmxpYyAtIG5vIGF1dGhvcml6YXRpb24gcmVxdWlyZWQpXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL2F1dGgvbG9naW4nLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IGF1dGhJbnRlZ3JhdGlvbixcbiAgICB9KVxuXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL2F1dGgvcmVnaXN0ZXInLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IGF1dGhJbnRlZ3JhdGlvbixcbiAgICB9KVxuXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL2F1dGgvcmVmcmVzaCcsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogYXV0aEludGVncmF0aW9uLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXV0aC92ZXJpZnknLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IGF1dGhJbnRlZ3JhdGlvbixcbiAgICB9KVxuXG4gICAgLy8gVXNlciByb3V0ZXMgKHByb3RlY3RlZCAtIHJlcXVpcmVzIEpXVCBhdXRob3JpemF0aW9uKVxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy91c2VycycsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuR0VULCBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5QT1NUXSxcbiAgICAgIGludGVncmF0aW9uOiB1c2VySW50ZWdyYXRpb24sXG4gICAgICBhdXRob3JpemVyOiBqd3RBdXRob3JpemVyLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvdXNlcnMve2lkfScsXG4gICAgICBtZXRob2RzOiBbXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVCxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUFVULFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5ERUxFVEUsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgXSxcbiAgICAgIGludGVncmF0aW9uOiB1c2VySW50ZWdyYXRpb24sXG4gICAgICBhdXRob3JpemVyOiBqd3RBdXRob3JpemVyLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvdXNlcnMve2lkfS9wcm9maWxlJyxcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVQsIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBVVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogdXNlckludGVncmF0aW9uLFxuICAgICAgYXV0aG9yaXplcjogand0QXV0aG9yaXplcixcbiAgICB9KVxuXG4gICAgLy8gT3JkZXIgcm91dGVzIChwcm90ZWN0ZWQgLSByZXF1aXJlcyBKV1QgYXV0aG9yaXphdGlvbilcbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvb3JkZXJzJyxcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVQsIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IG9yZGVySW50ZWdyYXRpb24sXG4gICAgICBhdXRob3JpemVyOiBqd3RBdXRob3JpemVyLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvb3JkZXJzL3tpZH0nLFxuICAgICAgbWV0aG9kczogW1xuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBVVCxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuREVMRVRFLFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5QQVRDSCxcbiAgICAgIF0sXG4gICAgICBpbnRlZ3JhdGlvbjogb3JkZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy9vcmRlcnMve2lkfS9zdGF0dXMnLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBVVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogb3JkZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy91c2Vycy97dXNlcklkfS9vcmRlcnMnLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogb3JkZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIC8vIEhlYWx0aCBjaGVjayByb3V0ZSAocHVibGljKVxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy9oZWFsdGgnLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oJ0hlYWx0aEludGVncmF0aW9uJywgYXV0aEZ1bmN0aW9uKSxcbiAgICB9KVxuXG4gICAgLy8gQ3JlYXRlIGRlZmF1bHQgc3RhZ2Ugd2l0aCBsb2dnaW5nXG4gICAgY29uc3QgZGVmYXVsdFN0YWdlID0gdGhpcy5odHRwQXBpLmRlZmF1bHRTdGFnZSBhcyBhcGlnYXRld2F5djIuSHR0cFN0YWdlXG4gICAgaWYgKGRlZmF1bHRTdGFnZSkge1xuICAgICAgLy8gRW5hYmxlIGFjY2VzcyBsb2dnaW5nXG4gICAgICBkZWZhdWx0U3RhZ2Uubm9kZS5hZGREZXBlbmRlbmN5KGxvZ0dyb3VwKVxuICAgIH1cblxuICAgIC8vIEFkZCB0aHJvdHRsaW5nIGZvciBwcm9kdWN0aW9uIHVzaW5nIHJvdXRlLWxldmVsIHRocm90dGxpbmdcbiAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdwcm9kJykge1xuICAgICAgLy8gTm90ZTogSFRUUCBBUEkgdjIgZG9lc24ndCBzdXBwb3J0IHN0YWdlLWxldmVsIHRocm90dGxpbmcgbGlrZSBSRVNUIEFQSVxuICAgICAgLy8gVGhyb3R0bGluZyBjYW4gYmUgaW1wbGVtZW50ZWQgYXQgdGhlIExhbWJkYSBsZXZlbCBvciB1c2luZyBBV1MgV0FGXG4gICAgICAvLyBGb3Igbm93LCB3ZSdsbCByZWx5IG9uIExhbWJkYSBjb25jdXJyZW5jeSBsaW1pdHMgYW5kIG1vbml0b3JpbmdcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNoIGFsYXJtcyBmb3IgQVBJIEdhdGV3YXlcbiAgICB0aGlzLmNyZWF0ZUNsb3VkV2F0Y2hBbGFybXMoZW52aXJvbm1lbnQpXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0h0dHBBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5odHRwQXBpLmFwaUVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdIVFRQIEFQSSBHYXRld2F5IGVuZHBvaW50IFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tYXBpLWdhdGV3YXktdXJsYCxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0h0dHBBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmh0dHBBcGkuaHR0cEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdIVFRQIEFQSSBHYXRld2F5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZ2F0ZXdheS1pZGAsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXRob3JpemVyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXRob3JpemVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0pXVCBBdXRob3JpemVyIGZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tYXV0aG9yaXplci1mdW5jdGlvbi1hcm5gLFxuICAgIH0pXG5cbiAgICAvLyBUYWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KVxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdTZXJ2ZXJsZXNzTWljcm9zZXJ2aWNlcycpXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnQXBpR2F0ZXdheScpXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNsb3VkV2F0Y2hBbGFybXMoZW52aXJvbm1lbnQ6IHN0cmluZykge1xuICAgIC8vIEFQSSBHYXRld2F5IDRYWCBlcnJvcnMgYWxhcm1cbiAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGk0WFhFcnJvckFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtlbnZpcm9ubWVudH0tYXBpLWdhdGV3YXktNHh4LWVycm9yc2AsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCByYXRlIG9mIDRYWCBlcnJvcnMgaW4gQVBJIEdhdGV3YXknLFxuICAgICAgbWV0cmljOiBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IHRoaXMuaHR0cEFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAyMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KVxuXG4gICAgLy8gQVBJIEdhdGV3YXkgNVhYIGVycm9ycyBhbGFybVxuICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0FwaTVYWEVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZ2F0ZXdheS01eHgtZXJyb3JzYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIHJhdGUgb2YgNVhYIGVycm9ycyBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBtZXRyaWM6IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogdGhpcy5odHRwQXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNkay5hd3NfY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSlcblxuICAgIC8vIEFQSSBHYXRld2F5IGxhdGVuY3kgYWxhcm1cbiAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGlMYXRlbmN5QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZ2F0ZXdheS1sYXRlbmN5YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIGxhdGVuY3kgaW4gQVBJIEdhdGV3YXknLFxuICAgICAgbWV0cmljOiBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogdGhpcy5odHRwQXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzMDAwLCAvLyAzIHNlY29uZHNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KVxuXG4gICAgLy8gQVBJIEdhdGV3YXkgcmVxdWVzdCBjb3VudCBmb3IgbW9uaXRvcmluZ1xuICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IHRoaXMuaHR0cEFwaS5hcGlJZCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KVxuICB9XG59Il19
