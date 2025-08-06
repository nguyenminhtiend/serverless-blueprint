import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  readonly environment?: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';

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

    // User Pool App Client for JWT token generation
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${environment}-serverless-microservices-client`,

      // Auth flows
      authFlows: {
        userSrp: true, // Secure Remote Password protocol
        userPassword: true, // Enable direct password auth for simple API usage
        adminUserPassword: false, // Admin auth disabled
        custom: false, // Custom auth disabled for now
      },

      // OAuth configuration for future use
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'http://localhost:3000/auth/callback', // For local development
          // Production URLs can be added via context or environment variables
        ],
        logoutUrls: [
          'http://localhost:3000/auth/logout',
          // Production URLs can be added via context or environment variables
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

    // User Pool Domain for hosted UI (optional, for future use)
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `${environment}-serverless-microservices-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${environment}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
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
  }
}
