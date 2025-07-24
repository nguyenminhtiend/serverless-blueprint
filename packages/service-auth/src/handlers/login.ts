import {
  AuthFlowType,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import { createPublicApiHandler, createRouterSuccessResponse } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthChallenge, AuthTokens, loginSchema } from './shared/types';
import {
  addSecretHashIfNeeded,
  CLIENT_ID,
  cognitoClient,
  handleCognitoError,
  logger,
  parseRequestBody,
} from './shared/utils';

export const loginHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = parseRequestBody(event, loginSchema);
    logger.info('Processing login request', { email });

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
      logger.info('Authentication challenge required', {
        challengeName: result.ChallengeName,
        email,
      });

      const challengeResponse: AuthChallenge = {
        challenge: true,
        challengeName: result.ChallengeName,
        session: result.Session!,
        challengeParameters: result.ChallengeParameters || {},
      };

      return createRouterSuccessResponse(challengeResponse);
    }

    if (result.AuthenticationResult) {
      logger.info('Login successful', { email });

      const tokens: AuthTokens = {
        accessToken: result.AuthenticationResult.AccessToken!,
        idToken: result.AuthenticationResult.IdToken!,
        refreshToken: result.AuthenticationResult.RefreshToken!,
        expiresIn: result.AuthenticationResult.ExpiresIn!,
      };

      return createRouterSuccessResponse({ tokens });
    }

    throw new Error('Authentication failed - no result');
  } catch (error) {
    return handleCognitoError(error as Error & { name?: string }, 'Login');
  }
};

export const login = createPublicApiHandler(loginHandler, {
  logging: { serviceName: 'auth-service' },
});
