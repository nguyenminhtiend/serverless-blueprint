import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { ZodType } from 'zod';

export interface APIGatewayProxyEventV2WithJWTAuthorizer extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims: Record<string, string | number | boolean>;
        scopes?: string[] | null;
      };
      lambda?: Record<string, any>;
      iam?: {
        accessKey: string;
        accountId: string;
        callerId: string;
        cognitoAuthenticationProvider?: string;
        cognitoAuthenticationType?: string;
        cognitoIdentityId?: string;
        cognitoIdentityPoolId?: string;
        principalOrgId?: string;
        sourceIp: string;
        user: string;
        userAgent: string;
        userArn: string;
      };
    };
  };
}

export type JWTClaims = Record<string, string | number | boolean>;

export interface ParsedEvent
  extends Omit<APIGatewayProxyEventV2WithJWTAuthorizer, 'body' | 'pathParameters' | 'queryStringParameters'> {
  body: any;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
}

export interface LambdaContext {
  event: ParsedEvent;
  context: Context;
}

export type Handler = (ctx: LambdaContext) => Promise<any> | any;

export interface RouteSchema {
  body?: ZodType;
  query?: ZodType;
  path?: ZodType;
}

export interface Route {
  method: string;
  path: string;
  handler: Handler;
  schema?: RouteSchema;
}