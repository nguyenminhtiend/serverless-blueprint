import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface LambdaStackProps extends cdk.StackProps {
    readonly environment?: string;
    readonly table: dynamodb.Table;
}
export declare class LambdaStack extends cdk.Stack {
    readonly authFunction: nodejs.NodejsFunction;
    readonly userFunction: nodejs.NodejsFunction;
    readonly orderFunction: nodejs.NodejsFunction;
    readonly notificationFunction: nodejs.NodejsFunction;
    constructor(scope: Construct, id: string, props: LambdaStackProps);
    private createCloudWatchAlarms;
}
