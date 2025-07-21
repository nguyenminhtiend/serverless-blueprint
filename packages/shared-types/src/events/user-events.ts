import { BaseEvent } from './base';

export interface UserRegisteredData {
  userId: string;
  email: string;
  name: string;
  registrationMethod: 'email' | 'social';
}

export interface UserUpdatedData {
  userId: string;
  email: string;
  name: string;
  updatedFields: string[];
}

export interface UserDeletedData {
  userId: string;
  email: string;
  deletionReason: string;
}

export type UserRegisteredEvent = BaseEvent<UserRegisteredData> & {
  eventType: 'USER_REGISTERED';
  source: 'user.service';
};

export type UserUpdatedEvent = BaseEvent<UserUpdatedData> & {
  eventType: 'USER_UPDATED';
  source: 'user.service';
};

export type UserDeletedEvent = BaseEvent<UserDeletedData> & {
  eventType: 'USER_DELETED';
  source: 'user.service';
};

export type UserEvent = UserRegisteredEvent | UserUpdatedEvent | UserDeletedEvent;
