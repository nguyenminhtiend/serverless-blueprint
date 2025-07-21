import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
export interface ApiGatewayStackProps extends cdk.StackProps {
    readonly environment?: string;
    readonly authFunction: nodejs.NodejsFunction;
    readonly userFunction: nodejs.NodejsFunction;
    readonly orderFunction: nodejs.NodejsFunction;
}
export declare class ApiGatewayStack extends cdk.Stack {
    readonly httpApi: apigatewayv2.HttpApi;
    readonly authorizerFunction: nodejs.NodejsFunction;
    constructor(scope: Construct, id: string, props: ApiGatewayStackProps);
    private createCloudWatchAlarms;
}
