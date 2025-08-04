import {
  AuthFlowType,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import { LambdaContext, ok, internalError } from '@shared/core';
import { AuthChallenge, AuthTokens, LoginInput } from './shared/types';
import { addSecretHashIfNeeded, CLIENT_ID, cognitoClient, logger } from './shared/utils';

export const loginHandler = async (ctx: LambdaContext) => {
  try {
    const { email, password }: LoginInput = ctx.event.body;

    const authParameters: InitiateAuthCommandInput['AuthParameters'] = {
      USERNAME: email,
      PASSWORD: password,
    };

    addSecretHashIfNeeded(authParameters, email);

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParameters,
    });

    const result = await cognitoClient.send(command);

    if (result.ChallengeName) {
      const challengeResponse: AuthChallenge = {
        challenge: true,
        challengeName: result.ChallengeName,
        session: result.Session!,
        challengeParameters: result.ChallengeParameters || {},
      };

      return ok(challengeResponse);
    }

    if (result.AuthenticationResult) {
      const tokens: AuthTokens = {
        accessToken: result.AuthenticationResult.AccessToken!,
        idToken: result.AuthenticationResult.IdToken!,
        refreshToken: result.AuthenticationResult.RefreshToken!,
        expiresIn: result.AuthenticationResult.ExpiresIn!,
      };

      return ok({ tokens });
    }

    internalError('Authentication failed - no result');
  } catch (error) {
    if (error instanceof Error) {
      internalError(error.message);
    }
    internalError('Unknown error during login');
  }
};
