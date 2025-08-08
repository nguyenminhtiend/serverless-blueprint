import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  type InitiateAuthResponse,
  type SignUpResponse,
  type ConfirmSignUpResponse,
  type GetUserResponse,
} from '@aws-sdk/client-cognito-identity-provider';

export interface SignInResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface SignUpResult {
  userSub: string;
  codeDeliveryDetails?: {
    destination: string;
    deliveryMedium: string;
    attributeName: string;
  };
}

export interface UserInfo {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

class CognitoAuthClient {
  private client: CognitoIdentityProviderClient;
  private clientId: string;

  constructor() {
    if (!process.env.NEXT_PUBLIC_AWS_REGION) {
      throw new Error('NEXT_PUBLIC_AWS_REGION environment variable is required');
    }
    if (!process.env.NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID) {
      throw new Error('NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID environment variable is required');
    }

    this.client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
    });
    this.clientId = process.env.NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID;
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed - no result returned');
      }

      const { AuthenticationResult } = response;
      if (
        !AuthenticationResult.AccessToken ||
        !AuthenticationResult.RefreshToken ||
        !AuthenticationResult.IdToken
      ) {
        throw new Error('Authentication failed - missing tokens');
      }

      return {
        accessToken: AuthenticationResult.AccessToken,
        refreshToken: AuthenticationResult.RefreshToken,
        idToken: AuthenticationResult.IdToken,
        expiresIn: AuthenticationResult.ExpiresIn || 3600,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Sign in failed: ${error.message}`);
      }
      throw new Error('Sign in failed: Unknown error');
    }
  }

  async signUp(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<SignUpResult> {
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
        ],
      });

      const response = await this.client.send(command);

      if (!response.UserSub) {
        throw new Error('Sign up failed - no user ID returned');
      }

      return {
        userSub: response.UserSub,
        codeDeliveryDetails: response.CodeDeliveryDetails
          ? {
              destination: response.CodeDeliveryDetails.Destination || '',
              deliveryMedium: response.CodeDeliveryDetails.DeliveryMedium || '',
              attributeName: response.CodeDeliveryDetails.AttributeName || '',
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Sign up failed: ${error.message}`);
      }
      throw new Error('Sign up failed: Unknown error');
    }
  }

  async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: confirmationCode,
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Email confirmation failed: ${error.message}`);
      }
      throw new Error('Email confirmation failed: Unknown error');
    }
  }

  async refreshToken(refreshToken: string): Promise<SignInResult> {
    try {
      const command = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Token refresh failed - no result returned');
      }

      const { AuthenticationResult } = response;
      if (!AuthenticationResult.AccessToken || !AuthenticationResult.IdToken) {
        throw new Error('Token refresh failed - missing tokens');
      }

      return {
        accessToken: AuthenticationResult.AccessToken,
        refreshToken: refreshToken, // Refresh token is not returned, use the original
        idToken: AuthenticationResult.IdToken,
        expiresIn: AuthenticationResult.ExpiresIn || 3600,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Token refresh failed: ${error.message}`);
      }
      throw new Error('Token refresh failed: Unknown error');
    }
  }

  async getUser(accessToken: string): Promise<UserInfo> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      if (!response.UserAttributes) {
        throw new Error('Failed to get user info - no attributes returned');
      }

      const email = response.UserAttributes.find((attr) => attr.Name === 'email')?.Value || '';
      const firstName =
        response.UserAttributes.find((attr) => attr.Name === 'given_name')?.Value || '';
      const lastName =
        response.UserAttributes.find((attr) => attr.Name === 'family_name')?.Value || '';
      const emailVerified =
        response.UserAttributes.find((attr) => attr.Name === 'email_verified')?.Value === 'true';

      return {
        email,
        firstName,
        lastName,
        emailVerified,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get user info: ${error.message}`);
      }
      throw new Error('Failed to get user info: Unknown error');
    }
  }

  async signOut(accessToken: string): Promise<void> {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Sign out failed: ${error.message}`);
      }
      throw new Error('Sign out failed: Unknown error');
    }
  }
}

export const cognitoAuthClient = new CognitoAuthClient();
