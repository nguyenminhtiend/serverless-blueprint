import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  readonly environment?: string;
  readonly webAppDomain?: string;
  readonly additionalCallbackUrls?: string[];
  readonly additionalLogoutUrls?: string[];
  readonly cssUrl?: string;
  readonly logoUrl?: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';
    const webAppDomain = props?.webAppDomain || 'http://localhost:3000';
    const additionalCallbackUrls = props?.additionalCallbackUrls || [];
    const additionalLogoutUrls = props?.additionalLogoutUrls || [];
    const cssUrl = props?.cssUrl;
    const logoUrl = props?.logoUrl;

    // Cognito User Pool with email/password authentication
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${environment}-serverless-microservices-users`,

      // Sign-in configuration
      signInAliases: {
        email: true,
        username: false,
      },

      // Auto-verified attributes
      autoVerify: {
        email: true,
      },

      // Standard attributes required at signup
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },

      // Basic password policy (8+ chars, uppercase, lowercase, number)
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false, // Keep simple for basic setup
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Self signup enabled
      selfSignUpEnabled: true,

      // User verification
      userVerification: {
        emailSubject: 'Verify your email for Serverless Microservices',
        emailBody: 'Thank you for signing up! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Lambda triggers can be added later for custom authentication flows
      // lambdaTriggers: {},

      // Device tracking disabled for simplicity
      deviceTracking: {
        challengeRequiredOnNewDevice: false,
        deviceOnlyRememberedOnUserPrompt: false,
      },

      // MFA disabled for basic setup - can be enabled later
      mfa: cognito.Mfa.OFF,

      // Deletion protection for production
      deletionProtection: environment === 'prod',

      // Removal policy
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool App Client for PKCE OAuth flow
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${environment}-serverless-microservices-client`,

      // Auth flows - OAuth + PKCE flow compatible
      authFlows: {
        userSrp: true, // Enable SRP for Hosted UI compatibility
        userPassword: false, // Disable direct password auth for security
        adminUserPassword: false, // Admin auth disabled
        custom: false, // Custom auth disabled for now
      },

      // Enable PKCE for enhanced security
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],

      // Generate client secret: false for PKCE (public clients)
      generateSecret: false,

      // OAuth configuration for PKCE flow
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // Required for PKCE
          implicitCodeGrant: false, // Disabled for security
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          `${webAppDomain}/api/auth/callback`, // OAuth callback API endpoint
          'http://localhost:3000/api/auth/callback', // Development callback API
          ...additionalCallbackUrls,
        ],
        logoutUrls: [
          `${webAppDomain}/logout`, // Post-logout redirect (fixed path)
          `${webAppDomain}/`, // Also allow redirect to home
          'http://localhost:3000/logout', // Development logout
          'http://localhost:3000/', // Development home
          ...additionalLogoutUrls,
        ],
      },

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Prevent user existence errors for security
      preventUserExistenceErrors: true,

      // Read and write attributes
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        emailVerified: true,
        givenName: true,
        familyName: true,
      }),

      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        givenName: true,
        familyName: true,
      }),
    });

    // User Pool Domain for hosted UI with custom styling
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `${environment}-serverless-microservices-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // Add UI customization if CSS URL is provided
    if (cssUrl) {
      new cognito.CfnUserPoolUICustomizationAttachment(this, 'UICustomization', {
        userPoolId: this.userPool.userPoolId,
        clientId: 'ALL', // Apply to all clients
        css: `@import url('${cssUrl}');${
          logoUrl
            ? `
/* Logo customization */
.amplify-image, .logo {
  content: url('${logoUrl}');
  max-width: 120px;
  height: auto;
}`
            : ''
        }`,
      });
    }

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${environment}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (PKCE OAuth)',
      exportName: `${environment}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${environment}-user-pool-arn`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      description: 'Cognito User Pool Domain URL',
      exportName: `${environment}-user-pool-domain-url`,
    });

    new cdk.CfnOutput(this, 'CognitoDomainName', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Domain Name for OAuth URLs',
      exportName: `${environment}-cognito-domain-name`,
    });

    new cdk.CfnOutput(this, 'OAuthCallbackUrl', {
      value: `${webAppDomain}/api/auth/callback`,
      description: 'OAuth Callback API URL',
      exportName: `${environment}-oauth-callback-url`,
    });

    new cdk.CfnOutput(this, 'OAuthLogoutUrl', {
      value: `${webAppDomain}/auth/logout`,
      description: 'OAuth Logout URL',
      exportName: `${environment}-oauth-logout-url`,
    });
  }
}
