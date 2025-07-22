import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  SignUpCommand,
  SignUpCommandInput,
  ConfirmSignUpCommandInput,
  ForgotPasswordCommandInput,
  ConfirmForgotPasswordCommandInput,
  InitiateAuthCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { createLogger } from '@shared/core';
import { createPublicApiHandler } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';

// Environment variables
const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REGION = process.env.AWS_REGION || 'ap-southeast-1';

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const logger = createLogger('auth-service');

// Constants
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
} as const;

// Types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthChallenge {
  challenge: boolean;
  challengeName: string;
  session: string;
  challengeParameters: Record<string, string>;
}

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

// Helper functions
function calculateSecretHash(email: string): string {
  if (!CLIENT_SECRET) return '';

  const message = email + CLIENT_ID;
  const hmac = createHmac('SHA256', CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest('base64');
}

function createSuccessResponse<T>(
  data: T,
  statusCode: number = HTTP_STATUS.OK,
  message?: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      success: true,
      data,
      ...(message && { message }),
    } as ApiResponse<T>),
  };
}

function createErrorResponse(
  error: string,
  code?: string,
  statusCode: number = HTTP_STATUS.BAD_REQUEST
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      code,
    } as ApiResponse),
  };
}

function parseRequestBody<T>(event: APIGatewayProxyEvent, schema: z.ZodSchema<T>): T {
  // Middy http-json-body-parser will parse JSON automatically
  // event.body will be an object when using middleware, string when not
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
  return schema.parse(body);
}

function addSecretHashIfNeeded(params: Record<string, any>, email: string): void {
  const secretHash = calculateSecretHash(email);
  if (secretHash) {
    params.SecretHash = secretHash;
  }
}

function getStatusCodeFromCognitoError(errorName: string): number {
  switch (errorName) {
    case 'NotAuthorizedException':
    case 'UserNotConfirmedException':
      return HTTP_STATUS.UNAUTHORIZED;
    case 'UserNotFoundException':
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return HTTP_STATUS.BAD_REQUEST;
    default:
      return HTTP_STATUS.BAD_REQUEST;
  }
}

// Login handler
const loginHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = parseRequestBody(event, loginSchema);
    logger.info('Processing login request', { email });

    const authParameters: InitiateAuthCommandInput['AuthParameters'] = {
      USERNAME: email,
      PASSWORD: password,
    };

    addSecretHashIfNeeded(authParameters, email);

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_SRP_AUTH,
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

      return createSuccessResponse(challengeResponse);
    }

    if (result.AuthenticationResult) {
      logger.info('Login successful', { email });

      const tokens: AuthTokens = {
        accessToken: result.AuthenticationResult.AccessToken!,
        idToken: result.AuthenticationResult.IdToken!,
        refreshToken: result.AuthenticationResult.RefreshToken!,
        expiresIn: result.AuthenticationResult.ExpiresIn!,
      };

      return createSuccessResponse({ tokens });
    }

    throw new Error('Authentication failed - no result');
  } catch (error: any) {
    logger.error('Login failed', { error: error.message, errorName: error.name });
    const statusCode = getStatusCodeFromCognitoError(error.name);
    return createErrorResponse(error.message || 'Login failed', error.name, statusCode);
  }
};

// Register handler
const registerHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    return createSuccessResponse(
      registerResponse,
      HTTP_STATUS.CREATED,
      'User registered successfully'
    );
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message, errorName: error.name });
    return createErrorResponse(error.message || 'Registration failed', error.name);
  }
};

// Confirm sign up handler
const confirmSignUpHandler = async (
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
    return createSuccessResponse(null, HTTP_STATUS.OK, 'Account confirmed successfully');
  } catch (error: any) {
    logger.error('Sign-up confirmation failed', { error: error.message, errorName: error.name });
    return createErrorResponse(error.message || 'Confirmation failed', error.name);
  }
};

// Forgot password handler
const forgotPasswordHandler = async (
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

    return createSuccessResponse(
      { deliveryDetails: result.CodeDeliveryDetails },
      HTTP_STATUS.OK,
      'Password reset code sent'
    );
  } catch (error: any) {
    logger.error('Forgot password request failed', { error: error.message, errorName: error.name });
    return createErrorResponse(error.message || 'Forgot password request failed', error.name);
  }
};

// Reset password handler
const resetPasswordHandler = async (
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
    return createSuccessResponse(null, HTTP_STATUS.OK, 'Password reset successfully');
  } catch (error: any) {
    logger.error('Password reset failed', { error: error.message, errorName: error.name });
    return createErrorResponse(error.message || 'Password reset failed', error.name);
  }
};

// Export raw handlers for internal routing
export {
  loginHandler,
  registerHandler,
  confirmSignUpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
};

// Export middleware-wrapped handlers for individual function deployment (optional)
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
