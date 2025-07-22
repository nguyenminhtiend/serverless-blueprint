import {
  ConfirmForgotPasswordCommand,
  ConfirmForgotPasswordCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  createPublicApiHandler,
  createRouterSuccessResponse,
  HTTP_STATUS,
} from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { resetPasswordSchema } from './shared/types';
import {
  CLIENT_ID,
  cognitoClient,
  logger,
  parseRequestBody,
  addSecretHashIfNeeded,
  handleCognitoError,
} from './shared/utils';

export const resetPasswordHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { email, confirmationCode, newPassword } = parseRequestBody(event, resetPasswordSchema);
    logger.info('Processing password reset', { email });

    const resetParams: ConfirmForgotPasswordCommandInput = {
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    };

    addSecretHashIfNeeded(resetParams, email);

    const command = new ConfirmForgotPasswordCommand(resetParams);
    await cognitoClient.send(command);

    logger.info('Password reset successful', { email });
    return createRouterSuccessResponse(null, HTTP_STATUS.OK, 'Password reset successfully');
  } catch (error) {
    return handleCognitoError(error as Error & { name?: string }, 'Password reset');
  }
};

export const resetPassword = createPublicApiHandler(resetPasswordHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});
