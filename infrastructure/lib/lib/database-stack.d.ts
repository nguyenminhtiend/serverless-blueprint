import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface DatabaseStackProps extends cdk.StackProps {
    readonly environment?: string;
}
export declare class DatabaseStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: DatabaseStackProps);
}
