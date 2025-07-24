import { SignUpCommand, SignUpCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import {
  createPublicApiHandler,
  createRouterSuccessResponse,
  HTTP_STATUS,
} from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { registerSchema } from './shared/types';
import {
  addSecretHashIfNeeded,
  CLIENT_ID,
  cognitoClient,
  handleCognitoError,
  logger,
  parseRequestBody,
} from './shared/utils';

export const registerHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password, givenName, familyName } = parseRequestBody(event, registerSchema);
    logger.info('Processing registration request', { email });

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

    logger.info('Registration successful', {
      email,
      userConfirmed: result.UserConfirmed,
    });

    const registerResponse = {
      userSub: result.UserSub!,
      userConfirmed: result.UserConfirmed!,
      needsConfirmation: !result.UserConfirmed,
    };

    return createRouterSuccessResponse(
      registerResponse,
      HTTP_STATUS.CREATED,
      'User registered successfully'
    );
  } catch (error) {
    return handleCognitoError(error as Error & { name?: string }, 'Registration');
  }
};

export const register = createPublicApiHandler(registerHandler, {
  logging: { serviceName: 'auth-service' },
});
