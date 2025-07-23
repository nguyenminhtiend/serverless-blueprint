import { createLogger } from '@shared/core';
import { EmailService, EmailServiceConfig } from './email-service';
import { SMSService, SMSServiceConfig } from './sms-service';
import {
  NotificationRequest,
  EmailNotification,
  SMSNotification,
  NotificationResult,
  EmailNotificationSchema,
  SMSNotificationSchema,
} from '../types/notification';

export interface NotificationServiceConfig {
  email: EmailServiceConfig;
  sms?: SMSServiceConfig;
}

/**
 * Main notification service that orchestrates different notification channels
 */
export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private logger = createLogger('notification-service');

  constructor(config: NotificationServiceConfig) {
    this.emailService = new EmailService(config.email);
    this.smsService = new SMSService(config.sms);

    this.logger.info('NotificationService initialized', {
      emailConfigured: true,
      smsConfigured: true,
    });
  }

  /**
   * Process notification request and route to appropriate service
   */
  async processNotification(request: NotificationRequest): Promise<NotificationResult> {
    const startTime = Date.now();

    this.logger.info('Processing notification request', {
      type: request.type,
      channel: request.channel,
      userId: request.userId,
      priority: request.priority,
    });

    try {
      let result: NotificationResult;

      switch (request.channel) {
        case 'EMAIL':
          result = await this.sendEmailNotification(request);
          break;

        case 'SMS':
          result = await this.sendSMSNotification(request);
          break;

        case 'PUSH':
          // Push notifications would be implemented here
          result = await this.sendPushNotification(request);
          break;

        default:
          throw new Error(`Unsupported notification channel: ${request.channel}`);
      }

      const duration = Date.now() - startTime;

      this.logger.info('Notification processed', {
        type: request.type,
        channel: request.channel,
        userId: request.userId,
        success: result.success,
        messageId: result.messageId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to process notification', {
        type: request.type,
        channel: request.channel,
        userId: request.userId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        errorCode: 'NOTIFICATION_PROCESSING_FAILED',
        errorMessage,
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // Validate and convert to email notification
      const emailNotification: EmailNotification = EmailNotificationSchema.parse({
        ...request,
        channel: 'EMAIL' as const,
      });

      return await this.emailService.sendEmail(emailNotification);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid email notification data';

      this.logger.error('Email notification validation failed', {
        error: errorMessage,
        request,
      });

      return {
        success: false,
        errorCode: 'EMAIL_VALIDATION_FAILED',
        errorMessage,
      };
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // Validate and convert to SMS notification
      const smsNotification: SMSNotification = SMSNotificationSchema.parse({
        ...request,
        channel: 'SMS' as const,
      });

      return await this.smsService.sendSMS(smsNotification);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid SMS notification data';

      this.logger.error('SMS notification validation failed', {
        error: errorMessage,
        request,
      });

      return {
        success: false,
        errorCode: 'SMS_VALIDATION_FAILED',
        errorMessage,
      };
    }
  }

  /**
   * Send push notification (placeholder - would integrate with FCM/APNS)
   */
  private async sendPushNotification(request: NotificationRequest): Promise<NotificationResult> {
    this.logger.warn('Push notifications not implemented yet', {
      type: request.type,
      userId: request.userId,
    });

    return {
      success: false,
      errorCode: 'PUSH_NOT_IMPLEMENTED',
      errorMessage: 'Push notifications are not yet implemented',
    };
  }

  /**
   * Send batch notifications
   */
  async processBatchNotifications(requests: NotificationRequest[]): Promise<NotificationResult[]> {
    const startTime = Date.now();

    this.logger.info('Processing batch notifications', {
      count: requests.length,
      types: [...new Set(requests.map(r => r.type))],
      channels: [...new Set(requests.map(r => r.channel))],
    });

    const results = await Promise.allSettled(
      requests.map(request => this.processNotification(request))
    );

    const notificationResults: NotificationResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const request = requests[index];
        this.logger.error('Batch notification failed', {
          type: request.type,
          channel: request.channel,
          userId: request.userId,
          error: result.reason,
        });

        return {
          success: false,
          errorCode: 'BATCH_PROCESSING_FAILED',
          errorMessage: result.reason?.message || 'Unknown batch processing error',
        };
      }
    });

    const successCount = notificationResults.filter(r => r.success).length;
    const failureCount = notificationResults.length - successCount;

    this.logger.info('Batch notifications processed', {
      total: requests.length,
      successCount,
      failureCount,
      duration: Date.now() - startTime,
    });

    return notificationResults;
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      email: { status: 'healthy' | 'unhealthy' };
      sms: { status: 'healthy' | 'unhealthy' };
    };
    timestamp: string;
  }> {
    try {
      const [emailHealth, smsHealth] = await Promise.allSettled([
        this.emailService.getHealth(),
        this.smsService.getHealth(),
      ]);

      const emailStatus =
        emailHealth.status === 'fulfilled' && emailHealth.value.status === 'healthy'
          ? 'healthy'
          : 'unhealthy';

      const smsStatus =
        smsHealth.status === 'fulfilled' && smsHealth.value.status === 'healthy'
          ? 'healthy'
          : 'unhealthy';

      const overallStatus =
        emailStatus === 'healthy' && smsStatus === 'healthy' ? 'healthy' : 'unhealthy';

      return {
        status: overallStatus,
        services: {
          email: { status: emailStatus },
          sms: { status: smsStatus },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Notification service health check failed', { error });

      return {
        status: 'unhealthy',
        services: {
          email: { status: 'unhealthy' },
          sms: { status: 'unhealthy' },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
