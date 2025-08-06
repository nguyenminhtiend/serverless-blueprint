import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { BaseLambdaFunction } from '../base-lambda-function';
import { EnvironmentConfig } from '../../config/environment-config';

export interface AuthFunctionProps {
  readonly environment: string;
  readonly config: EnvironmentConfig;
  readonly userPool?: cognito.UserPool;
  readonly userPoolClient?: cognito.UserPoolClient;
}

export class AuthFunction extends BaseLambdaFunction {
  constructor(scope: Construct, id: string, props: AuthFunctionProps) {
    const { environment, config, userPool, userPoolClient } = props;

    super(scope, id, {
      environment,
      config,
      functionName: `${environment}-auth-service`,
      entry: '../packages/service-auth/src/index.ts',
      description: 'Cognito-based authentication and authorization service',
      additionalEnvironmentVars: {
        USER_POOL_ID: userPool?.userPoolId || '',
        CLIENT_ID: userPoolClient?.userPoolClientId || '',
      },
    });

    // Add Cognito permissions
    if (userPool) {
      this.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminUpdateUserAttributes',
            'cognito-idp:AdminDeleteUser',
            'cognito-idp:AdminSetUserPassword',
            'cognito-idp:ListUsers',
            'cognito-idp:AdminListGroupsForUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminRemoveUserFromGroup',
            'cognito-idp:GetUser',
          ],
          resources: [userPool.userPoolArn],
        })
      );
    }
  }
}