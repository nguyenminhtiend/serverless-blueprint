import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface EventsStackProps extends cdk.StackProps {
  environment: string;
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly orderQueue: sqs.Queue;
  public readonly notificationQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    // Dead Letter Queue for failed messages
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `serverless-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Order Processing Queue
    this.orderQueue = new sqs.Queue(this, 'OrderQueue', {
      queueName: `order-processing-${props.environment}`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Notification Queue
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
      queueName: `notifications-${props.environment}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Custom EventBridge Bus
    this.eventBus = new events.EventBus(this, 'CustomEventBus', {
      eventBusName: `serverless-events-${props.environment}`,
    });

    // EventBridge Rules
    new events.Rule(this, 'OrderCreatedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['order.service'],
        detailType: ['Order Created'],
      },
      targets: [
        new eventsTargets.SqsQueue(this.orderQueue),
        new eventsTargets.SqsQueue(this.notificationQueue),
      ],
    });

    new events.Rule(this, 'UserRegisteredRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['user.service'],
        detailType: ['User Registered'],
      },
      targets: [new eventsTargets.SqsQueue(this.notificationQueue)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `EventBusArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'OrderQueueUrl', {
      value: this.orderQueue.queueUrl,
      exportName: `OrderQueueUrl-${props.environment}`,
    });
  }
}
