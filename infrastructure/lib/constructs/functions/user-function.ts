import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { BaseLambdaFunction } from '../base-lambda-function';
import { EnvironmentConfig } from '../../config/environment-config';

export interface UserFunctionProps {
  readonly environment: string;
  readonly config: EnvironmentConfig;
  readonly userPool?: cognito.UserPool;
}

export class UserFunction extends BaseLambdaFunction {
  constructor(scope: Construct, id: string, props: UserFunctionProps) {
    const { environment, config, userPool } = props;

    super(scope, id, {
      environment,
      config,
      functionName: `${environment}-user-service`,
      entry: '../packages/service-users/src/index.ts',
      description: 'User management service',
      additionalEnvironmentVars: {
        COGNITO_USER_POOL_ID: userPool?.userPoolId || '',
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