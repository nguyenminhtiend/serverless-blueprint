import { BaseEvent } from './base';

export interface EmailNotificationData {
  to: string;
  subject: string;
  template: string;
  templateData: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
}

export interface SmsNotificationData {
  to: string;
  message: string;
  countryCode: string;
}

export interface PushNotificationData {
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export type EmailNotificationEvent = BaseEvent<EmailNotificationData> & {
  eventType: 'EMAIL_NOTIFICATION';
  source: 'notification.service';
};

export type SmsNotificationEvent = BaseEvent<SmsNotificationData> & {
  eventType: 'SMS_NOTIFICATION';
  source: 'notification.service';
};

export type PushNotificationEvent = BaseEvent<PushNotificationData> & {
  eventType: 'PUSH_NOTIFICATION';
  source: 'notification.service';
};

export type NotificationEvent =
  | EmailNotificationEvent
  | SmsNotificationEvent
  | PushNotificationEvent;
