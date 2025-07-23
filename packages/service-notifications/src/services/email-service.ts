import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { createLogger } from '@shared/core';
import { EmailNotification, NotificationResult, EMAIL_TEMPLATES } from '../types/notification';

export interface EmailServiceConfig {
  region?: string;
  fromAddress: string;
  replyToAddresses?: string[];
  mockMode?: boolean; // When true, don't send real emails, just log
}

/**
 * AWS SES Email Service
 * Handles email notifications using AWS Simple Email Service
 */
export class EmailService {
  private sesClient: SESClient;
  private logger = createLogger('email-service');
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig) {
    this.config = {
      region: config.region || process.env.AWS_REGION || 'ap-southeast-1',
      mockMode: config.mockMode ?? (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_NOTIFICATIONS === 'true'),
      ...config,
    };

    this.sesClient = new SESClient({
      region: this.config.region,
    });

    this.logger.info('EmailService initialized', {
      region: this.config.region,
      fromAddress: this.config.fromAddress,
      mockMode: this.config.mockMode,
    });
  }

  /**
   * Send email notification
   */
  async sendEmail(notification: EmailNotification): Promise<NotificationResult> {
    const startTime = Date.now();

    this.logger.info('Sending email notification', {
      type: notification.type,
      recipient: notification.recipient,
      template: notification.template,
      priority: notification.priority,
    });

    try {
      // Render email content
      const { subject, htmlBody, textBody } = await this.renderEmailContent(notification);

      // Mock mode: Just log the email instead of sending
      if (this.config.mockMode) {
        const duration = Date.now() - startTime;
        const mockMessageId = `mock-email-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        this.logger.info('📧 MOCK EMAIL (not sent to avoid costs)', {
          type: notification.type,
          recipient: notification.recipient,
          subject,
          textContent: textBody.substring(0, 200) + '...',
          priority: notification.priority,
          mockMessageId,
          duration,
          note: 'Set ENABLE_MOCK_NOTIFICATIONS=false to send real emails',
        });

        return {
          success: true,
          messageId: mockMessageId,
          deliveredAt: new Date().toISOString(),
        };
      }

      // Real mode: Send actual email via SES
      const emailParams: SendEmailCommandInput = {
        Source: this.config.fromAddress,
        Destination: {
          ToAddresses: [notification.recipient],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
        ReplyToAddresses: this.config.replyToAddresses,
        Tags: [
          {
            Name: 'NotificationType',
            Value: notification.type,
          },
          {
            Name: 'Priority',
            Value: notification.priority,
          },
        ],
      };

      const command = new SendEmailCommand(emailParams);
      const response = await this.sesClient.send(command);

      const duration = Date.now() - startTime;

      this.logger.info('Email sent successfully', {
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

      this.logger.error('Failed to send email', {
        type: notification.type,
        recipient: notification.recipient,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        errorCode: 'EMAIL_SEND_FAILED',
        errorMessage,
      };
    }
  }

  /**
   * Render email content from template and payload
   */
  private async renderEmailContent(notification: EmailNotification): Promise<{
    subject: string;
    htmlBody: string;
    textBody: string;
  }> {
    const templateConfig = EMAIL_TEMPLATES[notification.type];

    // Use provided subject or template default
    const rawSubject = notification.subject || templateConfig.subject;
    const subject = this.interpolateTemplate(rawSubject, notification.payload);

    // Generate HTML body (in a real implementation, you'd use a template engine)
    const htmlBody = await this.generateHtmlBody(notification);

    // Generate text body (fallback for HTML)
    const textBody = await this.generateTextBody(notification);

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Generate HTML email body
   * In production, you'd use a proper template engine like Handlebars
   */
  private async generateHtmlBody(notification: EmailNotification): Promise<string> {
    const { type, payload } = notification;

    switch (type) {
      case 'ORDER_CREATED':
        return this.generateOrderCreatedHtml(payload);

      case 'ORDER_STATUS_CHANGED':
        return this.generateOrderStatusChangedHtml(payload);

      case 'ORDER_CANCELLED':
        return this.generateOrderCancelledHtml(payload);

      case 'PAYMENT_PROCESSED':
        return this.generatePaymentProcessedHtml(payload);

      case 'USER_WELCOME':
        return this.generateUserWelcomeHtml(payload);

      default:
        return this.generateGenericHtml(notification);
    }
  }

  /**
   * Generate text email body (fallback)
   */
  private async generateTextBody(notification: EmailNotification): Promise<string> {
    const { type, payload } = notification;

    switch (type) {
      case 'ORDER_CREATED':
        return `Order Confirmation\\n\\nYour order #${payload.orderId} has been confirmed.\\nTotal: $${payload.total}\\n\\nWe'll send you tracking information once your order ships.`;

      case 'ORDER_STATUS_CHANGED':
        return `Order Update\\n\\nYour order #${payload.orderId} status has been updated to: ${payload.newStatus}\\n\\nTrack your order at: ${payload.trackingUrl || 'our website'}`;

      case 'ORDER_CANCELLED':
        return `Order Cancelled\\n\\nYour order #${payload.orderId} has been cancelled.\\nRefund amount: $${payload.refundAmount}\\n\\nRefunds are processed within 3-5 business days.`;

      case 'PAYMENT_PROCESSED':
        return `Payment Confirmation\\n\\nPayment of $${payload.amount} for order #${payload.orderId} has been processed successfully.\\nPayment method: ${payload.method}`;

      case 'USER_WELCOME':
        return `Welcome!\\n\\nWelcome to our service, ${payload.firstName || 'there'}!\\n\\nYour account has been created successfully. You can now start using our platform.`;

      default:
        return `Notification\\n\\nYou have received a ${type} notification.`;
    }
  }

  /**
   * Template interpolation utility
   */
  private interpolateTemplate(template: string, payload: Record<string, unknown>): string {
    return template.replace(/#{(\w+)}/g, (match, key) => {
      const value = payload[key];
      return value !== undefined ? String(value) : match;
    });
  }

  // HTML template generators (simplified examples)
  private generateOrderCreatedHtml(payload: Record<string, unknown>): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Order Confirmation</h2>
          <p>Thank you for your order!</p>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${payload.orderId}</p>
            <p><strong>Total:</strong> $${payload.total}</p>
            <p><strong>Items:</strong> ${payload.itemCount || 'N/A'} items</p>
          </div>
          <p>We'll send you tracking information once your order ships.</p>
        </body>
      </html>
    `;
  }

  private generateOrderStatusChangedHtml(payload: Record<string, unknown>): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Order Status Update</h2>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <p><strong>Order ID:</strong> ${payload.orderId}</p>
            <p><strong>Previous Status:</strong> ${payload.previousStatus}</p>
            <p><strong>New Status:</strong> ${payload.newStatus}</p>
          </div>
          ${payload.trackingUrl ? `<p><a href="${payload.trackingUrl}">Track your order</a></p>` : ''}
        </body>
      </html>
    `;
  }

  private generateOrderCancelledHtml(payload: Record<string, unknown>): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Order Cancelled</h2>
          <p>Your order has been cancelled.</p>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <p><strong>Order ID:</strong> ${payload.orderId}</p>
            <p><strong>Refund Amount:</strong> $${payload.refundAmount}</p>
            <p><strong>Reason:</strong> ${payload.reason || 'N/A'}</p>
          </div>
          <p>Refunds are processed within 3-5 business days.</p>
        </body>
      </html>
    `;
  }

  private generatePaymentProcessedHtml(payload: Record<string, unknown>): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Payment Confirmation</h2>
          <p>Your payment has been processed successfully.</p>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <p><strong>Order ID:</strong> ${payload.orderId}</p>
            <p><strong>Amount:</strong> $${payload.amount}</p>
            <p><strong>Payment Method:</strong> ${payload.method}</p>
            <p><strong>Transaction ID:</strong> ${payload.paymentId}</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateUserWelcomeHtml(payload: Record<string, unknown>): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Welcome to Our Service!</h2>
          <p>Hi ${payload.firstName || 'there'},</p>
          <p>Welcome to our platform! Your account has been created successfully.</p>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <p><strong>Email:</strong> ${payload.email}</p>
            <p><strong>Account Created:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <p>You can now start using our services.</p>
        </body>
      </html>
    `;
  }

  private generateGenericHtml(notification: EmailNotification): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Notification</h2>
          <p>You have received a ${notification.type} notification.</p>
          <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
            <pre>${JSON.stringify(notification.payload, null, 2)}</pre>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get email service health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    config: EmailServiceConfig;
    timestamp: string;
  }> {
    try {
      // Simple health check in mock mode
      if (this.config.mockMode) {
        return {
          status: 'healthy',
          config: this.config,
          timestamp: new Date().toISOString(),
        };
      }

      // For real mode, we could test SES configuration
      // For now, just assume healthy if client is configured
      return {
        status: 'healthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Email service health check failed', { error });

      return {
        status: 'unhealthy',
        config: this.config,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
