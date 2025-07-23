import { SNSClient, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { createLogger } from '@shared/core';
import { SMSNotification, NotificationResult, SMS_TEMPLATES } from '../types/notification';

export interface SMSServiceConfig {
  region?: string;
  senderId?: string;
  mockMode?: boolean; // When true, don't send real SMS, just log
}

/**
 * AWS SNS SMS Service
 * Handles SMS notifications using AWS Simple Notification Service
 */
export class SMSService {
  private snsClient: SNSClient;
  private logger = createLogger('sms-service');
  private config: SMSServiceConfig;

  constructor(config: SMSServiceConfig = {}) {
    this.config = {
      region: config.region || process.env.AWS_REGION || 'ap-southeast-1',
      senderId: config.senderId || process.env.SMS_SENDER_ID || 'YourApp',
      mockMode: config.mockMode ?? (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_NOTIFICATIONS === 'true'),
    };

    this.snsClient = new SNSClient({
      region: this.config.region,
    });

    this.logger.info('SMSService initialized', {
      region: this.config.region,
      senderId: this.config.senderId,
      mockMode: this.config.mockMode,
    });
  }

  /**
   * Send SMS notification
   */
  async sendSMS(notification: SMSNotification): Promise<NotificationResult> {
    const startTime = Date.now();

    this.logger.info('Sending SMS notification', {
      type: notification.type,
      recipient: notification.recipient,
      priority: notification.priority,
    });

    try {
      // Render SMS content
      const message = this.renderSMSContent(notification);

      // Mock mode: Just log the SMS instead of sending
      if (this.config.mockMode) {
        const duration = Date.now() - startTime;
        const mockMessageId = `mock-sms-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        this.logger.info('📱 MOCK SMS (not sent to avoid costs)', {
          type: notification.type,
          recipient: notification.recipient,
          message,
          senderId: this.config.senderId,
          priority: notification.priority,
          mockMessageId,
          duration,
          note: 'Set ENABLE_MOCK_NOTIFICATIONS=false to send real SMS',
        });

        return {
          success: true,
          messageId: mockMessageId,
          deliveredAt: new Date().toISOString(),
        };
      }

      // Real mode: Send actual SMS via SNS
      const smsParams: PublishCommandInput = {
        PhoneNumber: notification.recipient,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: this.config.senderId,
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: notification.priority === 'URGENT' ? 'Transactional' : 'Promotional',
          },
        },
      };

      const command = new PublishCommand(smsParams);
      const response = await this.snsClient.send(command);

      const duration = Date.now() - startTime;

      this.logger.info('SMS sent successfully', {
        type: notification.type,
        recipient: notification.recipient,
        messageId: response.MessageId,
        duration,
      });

      return {
        success: true,
        messageId: response.MessageId,
        deliveredAt: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to send SMS', {
        type: notification.type,
        recipient: notification.recipient,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        errorCode: 'SMS_SEND_FAILED',
        errorMessage,
      };
    }
  }

  /**
   * Render SMS content from template and payload
   */
  private renderSMSContent(notification: SMSNotification): string {
    const template = SMS_TEMPLATES[notification.type as keyof typeof SMS_TEMPLATES];

    if (!template) {
      return `${notification.type} notification: ${JSON.stringify(notification.payload)}`;
    }

    // Interpolate template with payload data
    return this.interpolateTemplate(template, notification.payload);
  }

  /**
   * Template interpolation utility
   * Supports both #{key} and {key} formats for flexibility
   */
  private interpolateTemplate(template: string, payload: Record<string, unknown>): string {
    return (
      template
        // Handle #{key} format
        .replace(/#{(\w+)}/g, (match, key) => {
          const value = payload[key];
          return value !== undefined ? String(value) : match;
        })
        // Handle {key} format
        .replace(/{(\w+)}/g, (match, key) => {
          const value = payload[key];
          return value !== undefined ? String(value) : match;
        })
        // Handle ${key} format (for currency)
        .replace(/\$\{(\w+)\}/g, (match, key) => {
          const value = payload[key];
          return value !== undefined ? `$${value}` : match;
        })
    );
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[1-9]\\d{1,14}
    const e164Pattern = /^\+[1-9]\d{1,14}$/;
    return e164Pattern.test(phoneNumber);
  }

  /**
   * Format phone number to E.164 if needed
   */
  static formatPhoneNumber(phoneNumber: string, countryCode: string = '+1'): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');

    // If it already starts with +, return as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // If it's a US number without country code
    if (digits.length === 10 && countryCode === '+1') {
      return `+1${digits}`;
    }

    // If it's an international number without +
    if (digits.length > 10) {
      return `+${digits}`;
    }

    // Default: add provided country code
    return `${countryCode}${digits}`;
  }

  /**
   * Get SMS service health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    config: SMSServiceConfig;
    timestamp: string;
  }> {
    try {
      // Simple health check - validate SNS client configuration
      await this.snsClient.config.region();

      return {
        status: 'healthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('SMS service health check failed', { error });

      return {
        status: 'unhealthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
