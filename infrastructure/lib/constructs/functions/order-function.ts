import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { BaseLambdaFunction } from '../base-lambda-function';
import { EnvironmentConfig } from '../../config/environment-config';

export interface OrderFunctionProps {
  readonly environment: string;
  readonly config: EnvironmentConfig;
  readonly eventBusName?: string;
}

export class OrderFunction extends BaseLambdaFunction {
  constructor(scope: Construct, id: string, props: OrderFunctionProps) {
    const { environment, config, eventBusName } = props;

    super(scope, id, {
      environment,
      config,
      functionName: `${environment}-order-service`,
      entry: '../packages/service-orders/src/index.ts',
      description: 'Order management service',
      additionalEnvironmentVars: {
        EVENT_BUS_NAME: eventBusName || `serverless-events-${environment}`,
      },
    });

    // Add EventBridge permissions
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [
          `arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:event-bus/${eventBusName || `serverless-events-${environment}`}`,
        ],
      })
    );
  }
}