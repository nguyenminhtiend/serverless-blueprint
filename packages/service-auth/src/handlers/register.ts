import { SignUpCommand, SignUpCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import { LambdaContext, created, internalError } from '@shared/core';
import { RegisterInput } from './shared/types';
import { addSecretHashIfNeeded, CLIENT_ID, cognitoClient } from './shared/utils';

export const registerHandler = async (ctx: LambdaContext) => {
  try {
    const { email, password, givenName, familyName }: RegisterInput = ctx.event.body;

    const userAttributes = [{ Name: 'email', Value: email }];
    if (givenName) userAttributes.push({ Name: 'given_name', Value: givenName });
    if (familyName) userAttributes.push({ Name: 'family_name', Value: familyName });

    const signUpParams: SignUpCommandInput = {
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    };

    addSecretHashIfNeeded(signUpParams, email);

    const command = new SignUpCommand(signUpParams);
    const result = await cognitoClient.send(command);

    const registerResponse = {
      userSub: result.UserSub!,
      userConfirmed: result.UserConfirmed!,
      needsConfirmation: !result.UserConfirmed,
    };

    return created(registerResponse);
  } catch (error) {
    if (error instanceof Error) {
      internalError(error.message);
    }
    internalError('Unknown error during registration');
  }
};
