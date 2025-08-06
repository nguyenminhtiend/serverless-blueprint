import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BaseNestedStack, BaseNestedStackProps } from './base-nested-stack';

export interface EventsNestedStackProps extends BaseNestedStackProps {
  // Additional events-specific props can be added here
}

export class EventsNestedStack extends BaseNestedStack {
  public readonly eventBus: events.EventBus;
  public readonly orderQueue: sqs.Queue;
  public readonly notificationQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: EventsNestedStackProps) {
    super(scope, id, props);

    // Dead Letter Queue for failed messages
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${this.projectName}-dlq-${this.environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Order Processing Queue
    this.orderQueue = new sqs.Queue(this, 'OrderQueue', {
      queueName: `order-processing-${this.environment}`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Notification Queue
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
      queueName: `notifications-${this.environment}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Custom EventBridge Bus
    this.eventBus = new events.EventBus(this, 'CustomEventBus', {
      eventBusName: `${this.projectName}-events-${this.environment}`,
    });

    // EventBridge Rules for Order Events
    new events.Rule(this, 'OrderCreatedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['orders-service'],
        detailType: ['ORDER_CREATED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    new events.Rule(this, 'OrderStatusChangedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['orders-service'],
        detailType: ['ORDER_STATUS_CHANGED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    new events.Rule(this, 'OrderCancelledRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['orders-service'],
        detailType: ['ORDER_CANCELLED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    // EventBridge Rules for Payment Events
    new events.Rule(this, 'PaymentProcessedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['payment-service'],
        detailType: ['PAYMENT_PROCESSED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    // EventBridge Rules for User Events
    new events.Rule(this, 'UserCreatedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['users-service'],
        detailType: ['USER_CREATED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    new events.Rule(this, 'UserUpdatedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['users-service'],
        detailType: ['USER_UPDATED'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    // Catch-all rule for debugging and monitoring
    // Temporarily commented out due to CDK dependency issue
    // new events.Rule(this, 'AllEventsRule', {
    //   eventBus: this.eventBus,
    //   eventPattern: {
    //     source: ['orders-service', 'users-service', 'payment-service'],
    //   },
    //   targets: [
    //     new eventsTargets.CloudWatchLogGroup(
    //       new logs.LogGroup(this, 'EventsLogGroup', {
    //         logGroupName: `/aws/events/${this.projectName}-events-${this.environment}`,
    //         retention: logs.RetentionDays.ONE_WEEK,
    //       })
    //     ),
    //   ],
    // });

    // Outputs
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `EventBusArn-${this.environment}`,
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      exportName: `EventBusName-${this.environment}`,
    });

    new cdk.CfnOutput(this, 'OrderQueueUrl', {
      value: this.orderQueue.queueUrl,
      exportName: `OrderQueueUrl-${this.environment}`,
    });

    new cdk.CfnOutput(this, 'NotificationQueueUrl', {
      value: this.notificationQueue.queueUrl,
      exportName: `NotificationQueueUrl-${this.environment}`,
    });

    new cdk.CfnOutput(this, 'NotificationQueueArn', {
      value: this.notificationQueue.queueArn,
      exportName: `NotificationQueueArn-${this.environment}`,
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: this.deadLetterQueue.queueUrl,
      exportName: `DeadLetterQueueUrl-${this.environment}`,
    });

    // Additional tag for component identification
    cdk.Tags.of(this).add('Component', 'Events');
  }
}