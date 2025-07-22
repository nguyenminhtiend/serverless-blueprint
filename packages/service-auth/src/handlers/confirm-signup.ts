import {
  ConfirmSignUpCommand,
  ConfirmSignUpCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  createPublicApiHandler,
  createRouterSuccessResponse,
  HTTP_STATUS,
} from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { confirmSignUpSchema } from './shared/types';
import {
  CLIENT_ID,
  cognitoClient,
  logger,
  parseRequestBody,
  addSecretHashIfNeeded,
  handleCognitoError,
} from './shared/utils';

export const confirmSignUpHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { email, confirmationCode } = parseRequestBody(event, confirmSignUpSchema);
    logger.info('Processing sign-up confirmation', { email });

    const confirmParams: ConfirmSignUpCommandInput = {
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    };

    addSecretHashIfNeeded(confirmParams, email);

    const command = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(command);

    logger.info('Sign-up confirmation successful', { email });
    return createRouterSuccessResponse(null, HTTP_STATUS.OK, 'Account confirmed successfully');
  } catch (error) {
    return handleCognitoError(error as Error & { name?: string }, 'Sign-up confirmation');
  }
};

export const confirmSignUp = createPublicApiHandler(confirmSignUpHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});
