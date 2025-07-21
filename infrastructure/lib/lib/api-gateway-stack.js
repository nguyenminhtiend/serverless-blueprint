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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2Integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const apigatewayv2Authorizers = __importStar(require("aws-cdk-lib/aws-apigatewayv2-authorizers"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const nodejs = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
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
            bundling: {
                minify: true,
                sourceMap: true,
                target: 'es2022',
                format: nodejs.OutputFormat.ESM,
                externalModules: ['@aws-sdk/client-secrets-manager'],
                banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        // Grant secrets manager permissions to authorizer
        this.authorizerFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${environment}/microservices/*`,
            ],
        }));
        // Create CloudWatch Log Group for API Gateway
        const logGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
            logGroupName: `/aws/apigateway/${environment}-microservices-api`,
            retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
            removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Create HTTP API Gateway
        this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
            apiName: `${environment}-microservices-api`,
            description: `Serverless Microservices API - ${environment} environment`,
            corsPreflight: {
                allowCredentials: true,
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
        });
        // Create JWT Authorizer
        const jwtAuthorizer = new apigatewayv2Authorizers.HttpLambdaAuthorizer('JwtAuthorizer', this.authorizerFunction, {
            authorizerName: `${environment}-jwt-authorizer`,
            responseTypes: [apigatewayv2Authorizers.HttpLambdaResponseType.SIMPLE],
            resultsCacheTtl: cdk.Duration.minutes(5),
            identitySource: ['$request.header.Authorization'],
        });
        // Create Lambda integrations
        const authIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('AuthIntegration', authFunction);
        const userIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('UserIntegration', userFunction);
        const orderIntegration = new apigatewayv2Integrations.HttpLambdaIntegration('OrderIntegration', orderFunction);
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
            integration: new apigatewayv2Integrations.HttpLambdaIntegration('HealthIntegration', authFunction),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9hcGktZ2F0ZXdheS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMsMkVBQTREO0FBQzVELG9HQUFxRjtBQUNyRixrR0FBbUY7QUFDbkYsK0RBQWdEO0FBQ2hELHNFQUF1RDtBQUN2RCwyREFBNEM7QUFVNUMsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLE9BQU8sQ0FBc0I7SUFDN0Isa0JBQWtCLENBQXVCO0lBRXpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFFdkIsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUE7UUFDOUMsTUFBTSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEdBQUcsS0FBSyxDQUFBO1FBRTNELHdDQUF3QztRQUN4QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM5RSxZQUFZLEVBQUUsR0FBRyxXQUFXLGlCQUFpQjtZQUM3QyxLQUFLLEVBQUUsaURBQWlEO1lBQ3hELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTTtZQUN4QyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxXQUFXLEVBQUU7Z0JBQ1gsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLFNBQVMsRUFBRSxX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QUFLO2FBQzVCO1lBQ0QsU0FBUyxFQUFFLEtBQUs7WUFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNoQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUEvUkQsMENBK1JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djJJbnRlZ3JhdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mi1pbnRlZ3JhdGlvbnMnXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djJBdXRob3JpemVycyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWF1dGhvcml6ZXJzJ1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnXG5pbXBvcnQgKiBhcyBub2RlanMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJ1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcblxuZXhwb3J0IGludGVyZmFjZSBBcGlHYXRld2F5U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ/OiBzdHJpbmdcbiAgcmVhZG9ubHkgYXV0aEZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb25cbiAgcmVhZG9ubHkgdXNlckZ1bmN0aW9uOiBub2RlanMuTm9kZWpzRnVuY3Rpb25cbiAgcmVhZG9ubHkgb3JkZXJGdW5jdGlvbjogbm9kZWpzLk5vZGVqc0Z1bmN0aW9uXG59XG5cbmV4cG9ydCBjbGFzcyBBcGlHYXRld2F5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgaHR0cEFwaTogYXBpZ2F0ZXdheXYyLkh0dHBBcGlcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcml6ZXJGdW5jdGlvbjogbm9kZWpzLk5vZGVqc0Z1bmN0aW9uXG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFwaUdhdGV3YXlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQgfHwgJ2RldidcbiAgICBjb25zdCB7IGF1dGhGdW5jdGlvbiwgdXNlckZ1bmN0aW9uLCBvcmRlckZ1bmN0aW9uIH0gPSBwcm9wc1xuXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBKV1QgYXV0aG9yaXplciBmdW5jdGlvblxuICAgIHRoaXMuYXV0aG9yaXplckZ1bmN0aW9uID0gbmV3IG5vZGVqcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnQXV0aG9yaXplckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtlbnZpcm9ubWVudH0tand0LWF1dGhvcml6ZXJgLFxuICAgICAgZW50cnk6ICcuLi9wYWNrYWdlcy9zaGFyZWQtbWlkZGxld2FyZS9zcmMvYXV0aG9yaXplci50cycsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBkZXNjcmlwdGlvbjogJ0pXVCBDdXN0b20gQXV0aG9yaXplciBmb3IgQVBJIEdhdGV3YXknLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6IGVudmlyb25tZW50LFxuICAgICAgICBMT0dfTEVWRUw6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnV0FSTicgOiAnSU5GTycsXG4gICAgICAgIEpXVF9TRUNSRVRfTkFNRTogYCR7ZW52aXJvbm1lbnR9L21pY3Jvc2VydmljZXMvand0LXNlY3JldGAsXG4gICAgICB9LFxuICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIHRhcmdldDogJ2VzMjAyMicsXG4gICAgICAgIGZvcm1hdDogbm9kZWpzLk91dHB1dEZvcm1hdC5FU00sXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydAYXdzLXNkay9jbGllbnQtc2VjcmV0cy1tYW5hZ2VyJ10sXG4gICAgICAgIGJhbm5lcjogXCJpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbW9kdWxlJzsgY29uc3QgcmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoaW1wb3J0Lm1ldGEudXJsKTtcIixcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSlcblxuICAgIC8vIEdyYW50IHNlY3JldHMgbWFuYWdlciBwZXJtaXNzaW9ucyB0byBhdXRob3JpemVyXG4gICAgdGhpcy5hdXRob3JpemVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJ10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6c2VjcmV0c21hbmFnZXI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnNlY3JldDoke2Vudmlyb25tZW50fS9taWNyb3NlcnZpY2VzLypgLFxuICAgICAgXSxcbiAgICB9KSlcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIExvZyBHcm91cCBmb3IgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBcGlHYXRld2F5TG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvJHtlbnZpcm9ubWVudH0tbWljcm9zZXJ2aWNlcy1hcGlgLFxuICAgICAgcmV0ZW50aW9uOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pXG5cbiAgICAvLyBDcmVhdGUgSFRUUCBBUEkgR2F0ZXdheVxuICAgIHRoaXMuaHR0cEFwaSA9IG5ldyBhcGlnYXRld2F5djIuSHR0cEFwaSh0aGlzLCAnSHR0cEFwaScsIHtcbiAgICAgIGFwaU5hbWU6IGAke2Vudmlyb25tZW50fS1taWNyb3NlcnZpY2VzLWFwaWAsXG4gICAgICBkZXNjcmlwdGlvbjogYFNlcnZlcmxlc3MgTWljcm9zZXJ2aWNlcyBBUEkgLSAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgICBjb3JzUHJlZmxpZ2h0OiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbicsICdYLVJlcXVlc3RlZC1XaXRoJ10sXG4gICAgICAgIGFsbG93TWV0aG9kczogW1xuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLlBPU1QsXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLlBVVCxcbiAgICAgICAgICBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuREVMRVRFLFxuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5QQVRDSCxcbiAgICAgICAgICBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuT1BUSU9OUyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gWydodHRwczovL3lvdXJkb21haW4uY29tJ10gLy8gUmVwbGFjZSB3aXRoIGFjdHVhbCBwcm9kdWN0aW9uIGRvbWFpblxuICAgICAgICAgIDogWycqJ10sIC8vIEFsbG93IGFsbCBvcmlnaW5zIGluIGRldlxuICAgICAgICBtYXhBZ2U6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIENyZWF0ZSBKV1QgQXV0aG9yaXplclxuICAgIGNvbnN0IGp3dEF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheXYyQXV0aG9yaXplcnMuSHR0cExhbWJkYUF1dGhvcml6ZXIoJ0p3dEF1dGhvcml6ZXInLCB0aGlzLmF1dGhvcml6ZXJGdW5jdGlvbiwge1xuICAgICAgYXV0aG9yaXplck5hbWU6IGAke2Vudmlyb25tZW50fS1qd3QtYXV0aG9yaXplcmAsXG4gICAgICByZXNwb25zZVR5cGVzOiBbYXBpZ2F0ZXdheXYyQXV0aG9yaXplcnMuSHR0cExhbWJkYVJlc3BvbnNlVHlwZS5TSU1QTEVdLFxuICAgICAgcmVzdWx0c0NhY2hlVHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGlkZW50aXR5U291cmNlOiBbJyRyZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJ10sXG4gICAgfSlcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgaW50ZWdyYXRpb25zXG4gICAgY29uc3QgYXV0aEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2MkludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oJ0F1dGhJbnRlZ3JhdGlvbicsIGF1dGhGdW5jdGlvbilcbiAgICBjb25zdCB1c2VySW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbignVXNlckludGVncmF0aW9uJywgdXNlckZ1bmN0aW9uKVxuICAgIGNvbnN0IG9yZGVySW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbignT3JkZXJJbnRlZ3JhdGlvbicsIG9yZGVyRnVuY3Rpb24pXG5cbiAgICAvLyBBdXRoIHJvdXRlcyAocHVibGljIC0gbm8gYXV0aG9yaXphdGlvbiByZXF1aXJlZClcbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXV0aC9sb2dpbicsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogYXV0aEludGVncmF0aW9uLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXV0aC9yZWdpc3RlcicsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogYXV0aEludGVncmF0aW9uLFxuICAgIH0pXG5cbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYXV0aC9yZWZyZXNoJyxcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5QT1NUXSxcbiAgICAgIGludGVncmF0aW9uOiBhdXRoSW50ZWdyYXRpb24sXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy9hdXRoL3ZlcmlmeScsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogYXV0aEludGVncmF0aW9uLFxuICAgIH0pXG5cbiAgICAvLyBVc2VyIHJvdXRlcyAocHJvdGVjdGVkIC0gcmVxdWlyZXMgSldUIGF1dGhvcml6YXRpb24pXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL3VzZXJzJyxcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVQsIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgaW50ZWdyYXRpb246IHVzZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy91c2Vycy97aWR9JyxcbiAgICAgIG1ldGhvZHM6IFtcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuR0VULFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5QVVQsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkRFTEVURSxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUEFUQ0gsXG4gICAgICBdLFxuICAgICAgaW50ZWdyYXRpb246IHVzZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy91c2Vycy97aWR9L3Byb2ZpbGUnLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVCwgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUFVUXSxcbiAgICAgIGludGVncmF0aW9uOiB1c2VySW50ZWdyYXRpb24sXG4gICAgICBhdXRob3JpemVyOiBqd3RBdXRob3JpemVyLFxuICAgIH0pXG5cbiAgICAvLyBPcmRlciByb3V0ZXMgKHByb3RlY3RlZCAtIHJlcXVpcmVzIEpXVCBhdXRob3JpemF0aW9uKVxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy9vcmRlcnMnLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVCwgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogb3JkZXJJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSlcblxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy9vcmRlcnMve2lkfScsXG4gICAgICBtZXRob2RzOiBbXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVCxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUFVULFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5ERUxFVEUsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgXSxcbiAgICAgIGludGVncmF0aW9uOiBvcmRlckludGVncmF0aW9uLFxuICAgICAgYXV0aG9yaXplcjogand0QXV0aG9yaXplcixcbiAgICB9KVxuXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL29yZGVycy97aWR9L3N0YXR1cycsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUFVUXSxcbiAgICAgIGludGVncmF0aW9uOiBvcmRlckludGVncmF0aW9uLFxuICAgICAgYXV0aG9yaXplcjogand0QXV0aG9yaXplcixcbiAgICB9KVxuXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL3VzZXJzL3t1c2VySWR9L29yZGVycycsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuR0VUXSxcbiAgICAgIGludGVncmF0aW9uOiBvcmRlckludGVncmF0aW9uLFxuICAgICAgYXV0aG9yaXplcjogand0QXV0aG9yaXplcixcbiAgICB9KVxuXG4gICAgLy8gSGVhbHRoIGNoZWNrIHJvdXRlIChwdWJsaWMpXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuR0VUXSxcbiAgICAgIGludGVncmF0aW9uOiBuZXcgYXBpZ2F0ZXdheXYySW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbignSGVhbHRoSW50ZWdyYXRpb24nLCBhdXRoRnVuY3Rpb24pLFxuICAgIH0pXG5cbiAgICAvLyBDcmVhdGUgZGVmYXVsdCBzdGFnZSB3aXRoIGxvZ2dpbmdcbiAgICBjb25zdCBkZWZhdWx0U3RhZ2UgPSB0aGlzLmh0dHBBcGkuZGVmYXVsdFN0YWdlIGFzIGFwaWdhdGV3YXl2Mi5IdHRwU3RhZ2VcbiAgICBpZiAoZGVmYXVsdFN0YWdlKSB7XG4gICAgICAvLyBFbmFibGUgYWNjZXNzIGxvZ2dpbmdcbiAgICAgIGRlZmF1bHRTdGFnZS5ub2RlLmFkZERlcGVuZGVuY3kobG9nR3JvdXApXG4gICAgfVxuXG4gICAgLy8gQWRkIHRocm90dGxpbmcgZm9yIHByb2R1Y3Rpb24gdXNpbmcgcm91dGUtbGV2ZWwgdGhyb3R0bGluZ1xuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ3Byb2QnKSB7XG4gICAgICAvLyBOb3RlOiBIVFRQIEFQSSB2MiBkb2Vzbid0IHN1cHBvcnQgc3RhZ2UtbGV2ZWwgdGhyb3R0bGluZyBsaWtlIFJFU1QgQVBJXG4gICAgICAvLyBUaHJvdHRsaW5nIGNhbiBiZSBpbXBsZW1lbnRlZCBhdCB0aGUgTGFtYmRhIGxldmVsIG9yIHVzaW5nIEFXUyBXQUZcbiAgICAgIC8vIEZvciBub3csIHdlJ2xsIHJlbHkgb24gTGFtYmRhIGNvbmN1cnJlbmN5IGxpbWl0cyBhbmQgbW9uaXRvcmluZ1xuICAgIH1cblxuICAgIC8vIENsb3VkV2F0Y2ggYWxhcm1zIGZvciBBUEkgR2F0ZXdheVxuICAgIHRoaXMuY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcyhlbnZpcm9ubWVudClcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSHR0cEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmh0dHBBcGkuYXBpRW5kcG9pbnQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0hUVFAgQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZ2F0ZXdheS11cmxgLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSHR0cEFwaUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuaHR0cEFwaS5odHRwQXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0hUVFAgQVBJIEdhdGV3YXkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWFwaS1nYXRld2F5LWlkYCxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1dGhvcml6ZXJGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1dGhvcml6ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnSldUIEF1dGhvcml6ZXIgZnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hdXRob3JpemVyLWZ1bmN0aW9uLWFybmAsXG4gICAgfSlcblxuICAgIC8vIFRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnQpXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ1NlcnZlcmxlc3NNaWNyb3NlcnZpY2VzJylcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdBcGlHYXRld2F5JylcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcyhlbnZpcm9ubWVudDogc3RyaW5nKSB7XG4gICAgLy8gQVBJIEdhdGV3YXkgNFhYIGVycm9ycyBhbGFybVxuICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0FwaTRYWEVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZ2F0ZXdheS00eHgtZXJyb3JzYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIHJhdGUgb2YgNFhYIGVycm9ycyBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBtZXRyaWM6IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNFhYRXJyb3InLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgQXBpTmFtZTogdGhpcy5odHRwQXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDIwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pXG5cbiAgICAvLyBBUEkgR2F0ZXdheSA1WFggZXJyb3JzIGFsYXJtXG4gICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpNVhYRXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7ZW52aXJvbm1lbnR9LWFwaS1nYXRld2F5LTV4eC1lcnJvcnNgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggcmF0ZSBvZiA1WFggZXJyb3JzIGluIEFQSSBHYXRld2F5JyxcbiAgICAgIG1ldHJpYzogbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmh0dHBBcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KVxuXG4gICAgLy8gQVBJIEdhdGV3YXkgbGF0ZW5jeSBhbGFybVxuICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0FwaUxhdGVuY3lBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7ZW52aXJvbm1lbnR9LWFwaS1nYXRld2F5LWxhdGVuY3lgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbGF0ZW5jeSBpbiBBUEkgR2F0ZXdheScsXG4gICAgICBtZXRyaWM6IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiB0aGlzLmh0dHBBcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDMwMDAsIC8vIDMgc2Vjb25kc1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pXG5cbiAgICAvLyBBUEkgR2F0ZXdheSByZXF1ZXN0IGNvdW50IGZvciBtb25pdG9yaW5nXG4gICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgbWV0cmljTmFtZTogJ0NvdW50JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogdGhpcy5odHRwQXBpLmFwaUlkLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pXG4gIH1cbn0iXX0=