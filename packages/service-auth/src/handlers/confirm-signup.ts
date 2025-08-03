import {
  ConfirmSignUpCommand,
  ConfirmSignUpCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import { LambdaContext, ok, internalError } from '@shared/middleware';
import { ConfirmSignUpInput } from './shared/types';
import {
  addSecretHashIfNeeded,
  CLIENT_ID,
  cognitoClient,
  logger,
} from './shared/utils';

export const confirmSignUpHandler = async (ctx: LambdaContext) => {
  try {
    const { email, confirmationCode }: ConfirmSignUpInput = ctx.event.body;
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
    return ok({ message: 'Account confirmed successfully' });
  } catch (error) {
    logger.error('Sign-up confirmation error:', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error) {
      internalError(error.message);
    }
    internalError('Unknown error during sign-up confirmation');
  }
};
