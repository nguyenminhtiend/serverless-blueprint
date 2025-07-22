import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '@shared/core';
import { createPublicApiHandler } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';

// Environment variables
const CLIENT_ID = process.env.CLIENT_ID!;
const REGION = process.env.AWS_REGION || 'us-east-1';

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const logger = createLogger('auth-service');

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
});

const confirmSignUpSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(6).max(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(6).max(6),
  newPassword: z.string().min(8),
});

// Helper function to create crypto secure client secret hash
function calculateSecretHash(email: string): string {
  // If CLIENT_SECRET is not provided, return empty string
  // (for public clients without client secret)
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientSecret) return '';

  const crypto = require('crypto');
  const message = email + CLIENT_ID;
  const hmac = crypto.createHmac('SHA256', clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}

// Login handler
const loginHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = loginSchema.parse(body);

    logger.info('Processing login request', { email });

    const secretHash = calculateSecretHash(email);
    const authParameters: Record<string, string> = {
      USERNAME: email,
      PASSWORD: password,
    };

    // Add SECRET_HASH only if CLIENT_SECRET exists
    if (secretHash) {
      authParameters.SECRET_HASH = secretHash;
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_SRP_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParameters,
    });

    const result = await cognitoClient.send(command);

    if (result.ChallengeName) {
      // Handle authentication challenges (MFA, password change, etc.)
      logger.info('Authentication challenge required', {
        challengeName: result.ChallengeName,
        email,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          challenge: true,
          challengeName: result.ChallengeName,
          session: result.Session,
          challengeParameters: result.ChallengeParameters,
        }),
      };
    }

    if (result.AuthenticationResult) {
      logger.info('Login successful', { email });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          tokens: {
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            expiresIn: result.AuthenticationResult.ExpiresIn,
          },
        }),
      };
    }

    throw new Error('Authentication failed - no result');
  } catch (error: any) {
    logger.error('Login failed', { error: error.message });

    // Handle specific Cognito errors
    const statusCode = error.name === 'NotAuthorizedException' ? 401 : 400;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Login failed',
        code: error.name || 'LoginError',
      }),
    };
  }
};

// Register handler
const registerHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, givenName, familyName } = registerSchema.parse(body);

    logger.info('Processing registration request', { email });

    const secretHash = calculateSecretHash(email);
    const userAttributes = [{ Name: 'email', Value: email }];

    if (givenName) userAttributes.push({ Name: 'given_name', Value: givenName });
    if (familyName) userAttributes.push({ Name: 'family_name', Value: familyName });

    const signUpParams: any = {
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    };

    // Add SECRET_HASH only if CLIENT_SECRET exists
    if (secretHash) {
      signUpParams.SecretHash = secretHash;
    }

    const command = new SignUpCommand(signUpParams);
    const result = await cognitoClient.send(command);

    logger.info('Registration successful', {
      email,
      userConfirmed: result.UserConfirmed,
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'User registered successfully',
        userSub: result.UserSub,
        userConfirmed: result.UserConfirmed,
        needsConfirmation: !result.UserConfirmed,
      }),
    };
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message });

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Registration failed',
        code: error.name || 'RegistrationError',
      }),
    };
  }
};

// Confirm sign up handler
const confirmSignUpHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, confirmationCode } = confirmSignUpSchema.parse(body);

    logger.info('Processing sign-up confirmation', { email });

    const secretHash = calculateSecretHash(email);
    const confirmParams: any = {
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    };

    // Add SECRET_HASH only if CLIENT_SECRET exists
    if (secretHash) {
      confirmParams.SecretHash = secretHash;
    }

    const command = new ConfirmSignUpCommand(confirmParams);
    await cognitoClient.send(command);

    logger.info('Sign-up confirmation successful', { email });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Account confirmed successfully',
      }),
    };
  } catch (error: any) {
    logger.error('Sign-up confirmation failed', { error: error.message });

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Confirmation failed',
        code: error.name || 'ConfirmationError',
      }),
    };
  }
};

// Forgot password handler
const forgotPasswordHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = forgotPasswordSchema.parse(body);

    logger.info('Processing forgot password request', { email });

    const secretHash = calculateSecretHash(email);
    const forgotParams: any = {
      ClientId: CLIENT_ID,
      Username: email,
    };

    // Add SECRET_HASH only if CLIENT_SECRET exists
    if (secretHash) {
      forgotParams.SecretHash = secretHash;
    }

    const command = new ForgotPasswordCommand(forgotParams);
    const result = await cognitoClient.send(command);

    logger.info('Forgot password request processed', {
      email,
      deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Password reset code sent',
        deliveryDetails: result.CodeDeliveryDetails,
      }),
    };
  } catch (error: any) {
    logger.error('Forgot password request failed', { error: error.message });

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Forgot password request failed',
        code: error.name || 'ForgotPasswordError',
      }),
    };
  }
};

// Reset password handler
const resetPasswordHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, confirmationCode, newPassword } = resetPasswordSchema.parse(body);

    logger.info('Processing password reset', { email });

    const secretHash = calculateSecretHash(email);
    const resetParams: any = {
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    };

    // Add SECRET_HASH only if CLIENT_SECRET exists
    if (secretHash) {
      resetParams.SecretHash = secretHash;
    }

    const command = new ConfirmForgotPasswordCommand(resetParams);
    await cognitoClient.send(command);

    logger.info('Password reset successful', { email });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Password reset successfully',
      }),
    };
  } catch (error: any) {
    logger.error('Password reset failed', { error: error.message });

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Password reset failed',
        code: error.name || 'ResetPasswordError',
      }),
    };
  }
};

// Export handlers with middleware
export const login = createPublicApiHandler(loginHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});

export const register = createPublicApiHandler(registerHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});

export const confirmSignUp = createPublicApiHandler(confirmSignUpHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});

export const forgotPassword = createPublicApiHandler(forgotPasswordHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});

export const resetPassword = createPublicApiHandler(resetPasswordHandler, {
  logging: { serviceName: 'auth-service' },
  cors: true,
});
