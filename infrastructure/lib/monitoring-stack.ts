import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
// import * as logs from 'aws-cdk-lib/aws-logs'; // Not needed - Lambda auto-creates log groups
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  lambdaFunctions: { [key: string]: lambda.Function };
  apiGateway: apigateway.HttpApi;
  dynamoTable: dynamodb.Table;
  alertEmail?: string;
  enableDashboards?: boolean;
  enableAlarms?: boolean;
}

export class MonitoringStack extends cdk.Stack {
  public readonly criticalAlarmTopic?: sns.Topic;
  public readonly warningAlarmTopic?: sns.Topic;
  public readonly serviceOverviewDashboard?: cloudwatch.Dashboard;
  public readonly businessMetricsDashboard?: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Determine if we should enable expensive monitoring features
    const enableAlarms = props.enableAlarms ?? props.environment === 'prod';
    const enableDashboards = props.enableDashboards ?? props.environment === 'prod';

    // Log Groups are automatically created by Lambda functions
    // No need to create them explicitly here

    // SNS Topics for Alerting (only if alarms are enabled)
    if (enableAlarms) {
      this.criticalAlarmTopic = new sns.Topic(this, 'CriticalAlarms', {
        displayName: `Critical Alarms - ${props.environment}`,
        topicName: `serverless-critical-${props.environment}`,
      });

      this.warningAlarmTopic = new sns.Topic(this, 'WarningAlarms', {
        displayName: `Warning Alarms - ${props.environment}`,
        topicName: `serverless-warning-${props.environment}`,
      });

      // Email subscription if provided
      if (props.alertEmail) {
        this.criticalAlarmTopic.addSubscription(
          new subscriptions.EmailSubscription(props.alertEmail)
        );
        this.warningAlarmTopic.addSubscription(
          new subscriptions.EmailSubscription(props.alertEmail)
        );
      }

      // Lambda Function Monitoring
      this.createLambdaMonitoring(props.lambdaFunctions, props.environment);

      // API Gateway Monitoring
      this.createApiGatewayMonitoring(props.apiGateway, props.environment);

      // DynamoDB Monitoring
      this.createDynamoDBMonitoring(props.dynamoTable, props.environment);

      // Custom Metrics Namespace
      this.createCustomMetricsAlarms(props.environment);
    }

    // Dashboards (only if enabled)
    if (enableDashboards) {
      // Service Overview Dashboard
      this.serviceOverviewDashboard = this.createServiceOverviewDashboard(
        props.lambdaFunctions,
        props.apiGateway,
        props.dynamoTable,
        props.environment
      );

      // Business Metrics Dashboard
      this.businessMetricsDashboard = this.createBusinessMetricsDashboard(props.environment);
    }

    // Output monitoring configuration for transparency
    new cdk.CfnOutput(this, 'MonitoringConfig', {
      value: JSON.stringify({
        environment: props.environment,
        alarmsEnabled: enableAlarms,
        dashboardsEnabled: enableDashboards,
        estimatedMonthlyCost: enableDashboards ? '$6-8' : '$0-1',
      }),
      description: 'Monitoring configuration and estimated costs',
    });
  }

  // Log groups are automatically created by Lambda functions
  // Retention can be managed via Lambda function configuration

  private createLambdaMonitoring(
    functions: { [key: string]: lambda.Function },
    environment: string
  ) {
    Object.entries(functions).forEach(([name, func]) => {
      // Error Rate Alarm (Critical)
      const errorRateAlarm = new cloudwatch.Alarm(this, `${name}ErrorRateAlarm`, {
        alarmName: `Lambda-${name}-ErrorRate-${environment}`,
        alarmDescription: `Error rate > 1% for ${name} function`,
        metric: new cloudwatch.MathExpression({
          expression: '(errors / invocations) * 100',
          usingMetrics: {
            errors: func.metricErrors({ period: cdk.Duration.minutes(5) }),
            invocations: func.metricInvocations({ period: cdk.Duration.minutes(5) }),
          },
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      if (this.criticalAlarmTopic) {
        errorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlarmTopic));
      }

      // Duration Alarm (Warning)
      const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        alarmName: `Lambda-${name}-Duration-${environment}`,
        alarmDescription: `Duration > 80% of timeout for ${name} function`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: func.timeout ? func.timeout.toMilliseconds() * 0.8 : 24000, // 80% of timeout
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      if (this.warningAlarmTopic) {
        durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlarmTopic));
      }

      // Memory Utilization (Warning) - requires custom metric from Lambda
      const memoryAlarm = new cloudwatch.Alarm(this, `${name}MemoryAlarm`, {
        alarmName: `Lambda-${name}-Memory-${environment}`,
        alarmDescription: `Memory usage > 80% for ${name} function`,
        metric: new cloudwatch.Metric({
          namespace: 'ServerlessMicroservices',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            FunctionName: func.functionName,
          },
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 80,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      if (this.warningAlarmTopic) {
        memoryAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlarmTopic));
      }
    });
  }

  private createApiGatewayMonitoring(api: apigateway.HttpApi, environment: string) {
    // 5xx Error Rate (Critical)
    const serverErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: `API-5xx-ErrorRate-${environment}`,
      alarmDescription: '5xx error rate > 0.5% for API Gateway',
      metric: new cloudwatch.MathExpression({
        expression: '(e5xx / count) * 100',
        usingMetrics: {
          e5xx: new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: '5XXError',
            dimensionsMap: { ApiId: api.apiId },
            period: cdk.Duration.minutes(3),
            statistic: 'Sum',
          }),
          count: new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: 'Count',
            dimensionsMap: { ApiId: api.apiId },
            period: cdk.Duration.minutes(3),
            statistic: 'Sum',
          }),
        },
      }),
      threshold: 0.5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.criticalAlarmTopic) {
      serverErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlarmTopic));
    }

    // High Latency (Warning)
    const latencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `API-Latency-${environment}`,
      alarmDescription: 'API Gateway latency > 5000ms',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGatewayV2',
        metricName: 'IntegrationLatency',
        dimensionsMap: { ApiId: api.apiId },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 5000,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.warningAlarmTopic) {
      latencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlarmTopic));
    }
  }

  private createDynamoDBMonitoring(table: dynamodb.Table, environment: string) {
    // Read Throttles (Critical)
    const readThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadThrottleAlarm', {
      alarmName: `DynamoDB-ReadThrottle-${environment}`,
      alarmDescription: 'DynamoDB read throttling detected',
      metric: table.metricThrottledRequestsForOperations({
        operations: [
          dynamodb.Operation.GET_ITEM,
          dynamodb.Operation.QUERY,
          dynamodb.Operation.SCAN,
        ],
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.criticalAlarmTopic) {
      readThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlarmTopic));
    }

    // Write Throttles (Critical)
    const writeThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBWriteThrottleAlarm', {
      alarmName: `DynamoDB-WriteThrottle-${environment}`,
      alarmDescription: 'DynamoDB write throttling detected',
      metric: table.metricThrottledRequestsForOperations({
        operations: [
          dynamodb.Operation.PUT_ITEM,
          dynamodb.Operation.UPDATE_ITEM,
          dynamodb.Operation.DELETE_ITEM,
        ],
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.criticalAlarmTopic) {
      writeThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlarmTopic));
    }
  }

  private createServiceOverviewDashboard(
    functions: { [key: string]: lambda.Function },
    api: apigateway.HttpApi,
    table: dynamodb.Table,
    environment: string
  ): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ServiceOverviewDashboard', {
      dashboardName: `ServerlessMicroservices-Overview-${environment}`,
    });

    // API Gateway Metrics Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests & Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: 'Count',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: '4XXError',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: '5XXError',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'Sum',
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: 'IntegrationLatency',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGatewayV2',
            metricName: 'IntegrationLatency',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'p95',
          }),
        ],
        width: 12,
      })
    );

    // Lambda Functions Row
    const lambdaWidgets = Object.entries(functions).map(
      ([name, func]) =>
        new cloudwatch.GraphWidget({
          title: `Lambda - ${name}`,
          left: [func.metricInvocations()],
          right: [func.metricErrors(), func.metricDuration()],
          width: 6,
        })
    );
    dashboard.addWidgets(...lambdaWidgets);

    // DynamoDB Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Read/Write Capacity',
        left: [table.metricConsumedReadCapacityUnits(), table.metricConsumedWriteCapacityUnits()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Throttles & Errors',
        left: [
          table.metricThrottledRequestsForOperations({
            operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY],
          }),
          table.metricThrottledRequestsForOperations({
            operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM],
          }),
        ],
        width: 12,
      })
    );

    return dashboard;
  }

  private createBusinessMetricsDashboard(environment: string): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'BusinessMetricsDashboard', {
      dashboardName: `ServerlessMicroservices-Business-${environment}`,
    });

    // Business Metrics Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Orders - Creation Rate',
        left: [
          new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Orders',
            metricName: 'OrderCreated',
            statistic: 'Sum',
          }),
        ],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Orders - Failure Rate',
        left: [
          new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Orders',
            metricName: 'OrderCreationError',
            statistic: 'Sum',
          }),
        ],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Users - Authentication',
        left: [
          new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Auth',
            metricName: 'LoginSuccess',
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Auth',
            metricName: 'LoginFailure',
            statistic: 'Sum',
          }),
        ],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Users - Registration',
        left: [
          new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Auth',
            metricName: 'UserRegistered',
            statistic: 'Sum',
          }),
        ],
        width: 6,
      })
    );

    return dashboard;
  }

  private createCustomMetricsAlarms(environment: string) {
    // Order Creation Failure Rate (Business Alert)
    const orderFailureAlarm = new cloudwatch.Alarm(this, 'OrderFailureRateAlarm', {
      alarmName: `Orders-FailureRate-${environment}`,
      alarmDescription: 'Order failure rate > 0.1%',
      metric: new cloudwatch.MathExpression({
        expression: '(failures / (successes + failures)) * 100',
        usingMetrics: {
          failures: new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Orders',
            metricName: 'OrderCreationError',
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
          successes: new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Orders',
            metricName: 'OrderCreated',
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
        },
      }),
      threshold: 0.1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.warningAlarmTopic) {
      orderFailureAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlarmTopic));
    }

    // User Registration Failure Rate (Business Alert)
    const authFailureAlarm = new cloudwatch.Alarm(this, 'AuthFailureRateAlarm', {
      alarmName: `Auth-FailureRate-${environment}`,
      alarmDescription: 'Authentication failure rate > 5%',
      metric: new cloudwatch.MathExpression({
        expression: '(failures / (successes + failures)) * 100',
        usingMetrics: {
          failures: new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Auth',
            metricName: 'LoginFailure',
            statistic: 'Sum',
            period: cdk.Duration.minutes(10),
          }),
          successes: new cloudwatch.Metric({
            namespace: 'ServerlessMicroservices/Auth',
            metricName: 'LoginSuccess',
            statistic: 'Sum',
            period: cdk.Duration.minutes(10),
          }),
        },
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (this.warningAlarmTopic) {
      authFailureAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlarmTopic));
    }
  }
}
