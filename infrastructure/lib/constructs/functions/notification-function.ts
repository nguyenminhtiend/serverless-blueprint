import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { BaseLambdaFunction } from '../base-lambda-function';
import { EnvironmentConfig } from '../../config/environment-config';

export interface NotificationFunctionProps {
  readonly environment: string;
  readonly config: EnvironmentConfig;
  readonly notificationQueue?: sqs.Queue;
}

export class NotificationFunction extends BaseLambdaFunction {
  constructor(scope: Construct, id: string, props: NotificationFunctionProps) {
    const { environment, config, notificationQueue } = props;

    super(scope, id, {
      environment,
      config,
      functionName: `${environment}-notification-service`,
      entry: '../packages/service-notifications/src/handlers/event-handler.ts',
      handler: 'handleNotificationEvents',
      description: 'Event-driven notification service',
      timeout: cdk.Duration.seconds(60),
      additionalEnvironmentVars: {
        FROM_EMAIL_ADDRESS: config.notifications.email.fromAddress,
        REPLY_TO_ADDRESSES: config.notifications.email.replyToAddresses.join(','),
        SMS_SENDER_ID: config.notifications.sms.senderId,
        DEFAULT_USER_EMAIL: config.notifications.email.defaultUserEmail,
        DEFAULT_USER_PHONE: config.notifications.sms.defaultUserPhone,
        ENABLE_MOCK_NOTIFICATIONS: config.notifications.enableMock.toString(),
      },
    });

    // Add SQS event source if queue is provided
    if (notificationQueue) {
      this.addEventSource(
        new lambdaEventSources.SqsEventSource(notificationQueue, {
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.seconds(5),
          reportBatchItemFailures: true,
        })
      );
    }

    // Add SQS permissions
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [`arn:aws:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*${environment}*`],
      })
    );

    // Add SES permissions
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ses:SendEmail',
          'ses:SendRawEmail',
          'ses:SendBulkTemplatedEmail',
          'ses:SendTemplatedEmail',
        ],
        resources: ['*'],
      })
    );

    // Add SNS permissions
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'sns:GetSMSAttributes', 'sns:SetSMSAttributes'],
        resources: ['*'],
      })
    );
  }
}