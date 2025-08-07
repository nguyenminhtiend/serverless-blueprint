import { Duration } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface EnvironmentConfig {
  environment: 'dev' | 'prod';
  region: string;
  account?: string;

  // AWS Infrastructure
  aws: {
    region: string;
    defaultRegion: string;
  };

  // Lambda configuration
  lambda: {
    memorySize: number;
    timeout: Duration;
    enableRequestLogging: boolean;
    nodeEnv: string;
    logRetentionDays: number;
    logLevel: string;
    powertoolsLogLevel: string;
    powertoolsLoggerSampleRate: string;
  };

  // DynamoDB configuration
  dynamodb: {
    tableName: string;
  };

  // Cognito configuration
  cognito: {
    userPoolId?: string;
    clientId?: string;
    clientSecret?: string;
  };

  // EventBridge configuration
  eventBridge: {
    eventBusName: string;
  };

  // Notification configuration
  notifications: {
    enableMock: boolean;
    email: {
      fromAddress: string;
      replyToAddresses: string[];
      defaultUserEmail: string;
    };
    sms: {
      senderId: string;
      defaultUserPhone: string;
    };
  };

  // Application configuration
  application: {
    version: string;
    enableRequestLogging: boolean;
  };
}

export class EnvironmentConfigFactory {
  static create(environment: string): EnvironmentConfig {
    const baseConfig = this.getBaseConfig();

    switch (environment) {
      case 'prod':
        return this.getProductionConfig(baseConfig);
      default:
        return this.getDevelopmentConfig(baseConfig);
    }
  }

  private static getBaseConfig(): Partial<EnvironmentConfig> {
    return {
      region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1',
      account: process.env.CDK_DEFAULT_ACCOUNT,
      aws: {
        region: process.env.AWS_REGION || 'ap-southeast-1',
        defaultRegion: 'ap-southeast-1',
      },
      application: {
        version: process.env.VERSION || '1.0.0',
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
      },
      eventBridge: {
        eventBusName: process.env.EVENT_BUS_NAME || 'default',
      },
      cognito: {
        userPoolId: process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
      },
      notifications: {
        enableMock: process.env.ENABLE_MOCK_NOTIFICATIONS !== 'false',
        email: {
          fromAddress: process.env.FROM_EMAIL_ADDRESS || 'noreply@example.com',
          replyToAddresses: process.env.REPLY_TO_ADDRESSES
            ? process.env.REPLY_TO_ADDRESSES.split(',')
            : [],
          defaultUserEmail: process.env.DEFAULT_USER_EMAIL || 'user@example.com',
        },
        sms: {
          senderId: process.env.SMS_SENDER_ID || 'ServerlessApp',
          defaultUserPhone: process.env.DEFAULT_USER_PHONE || '',
        },
      },
    };
  }

  private static getProductionConfig(base: Partial<EnvironmentConfig>): EnvironmentConfig {
    return {
      ...base,
      environment: 'prod',
      lambda: {
        memorySize: 1024,
        timeout: Duration.seconds(30),
        enableRequestLogging: true,
        nodeEnv: 'production',
        logRetentionDays: logs.RetentionDays.ONE_MONTH,
        logLevel: 'WARN',
        powertoolsLogLevel: 'WARN',
        powertoolsLoggerSampleRate: '0.1',
      },
      dynamodb: {
        tableName: process.env.TABLE_NAME || 'prod-serverless-microservices',
      },
      notifications: {
        ...base.notifications!,
        enableMock: process.env.ENABLE_MOCK_NOTIFICATIONS === 'true',
      },
    } as EnvironmentConfig;
  }

  private static getDevelopmentConfig(base: Partial<EnvironmentConfig>): EnvironmentConfig {
    return {
      ...base,
      environment: 'dev',
      lambda: {
        memorySize: 256,
        timeout: Duration.seconds(15),
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
        nodeEnv: 'development',
        logRetentionDays: logs.RetentionDays.ONE_DAY,
        logLevel: 'INFO',
        powertoolsLogLevel: 'INFO',
        powertoolsLoggerSampleRate: '1',
      },
      dynamodb: {
        tableName: process.env.TABLE_NAME || 'dev-serverless-microservices',
      },
    } as EnvironmentConfig;
  }
}
