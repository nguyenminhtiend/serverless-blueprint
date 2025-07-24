import {
  ForgotPasswordCommand,
  ForgotPasswordCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  createPublicApiHandler,
  createRouterSuccessResponse,
  HTTP_STATUS,
} from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { forgotPasswordSchema } from './shared/types';
import {
  addSecretHashIfNeeded,
  CLIENT_ID,
  cognitoClient,
  handleCognitoError,
  logger,
  parseRequestBody,
} from './shared/utils';

export const forgotPasswordHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { email } = parseRequestBody(event, forgotPasswordSchema);
    logger.info('Processing forgot password request', { email });

    const forgotParams: ForgotPasswordCommandInput = {
      ClientId: CLIENT_ID,
      Username: email,
    };

    addSecretHashIfNeeded(forgotParams, email);

    const command = new ForgotPasswordCommand(forgotParams);
    const result = await cognitoClient.send(command);

    logger.info('Forgot password request processed', {
      email,
      deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium,
    });

    return createRouterSuccessResponse(
      { deliveryDetails: result.CodeDeliveryDetails },
      HTTP_STATUS.OK,
      'Password reset code sent'
    );
  } catch (error) {
    return handleCognitoError(error as Error & { name?: string }, 'Forgot password request');
  }
};

export const forgotPassword = createPublicApiHandler(forgotPasswordHandler, {
  logging: { serviceName: 'auth-service' },
});
