import { z } from 'zod';

// Base validation schemas
export const addressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zipCode: z.string().min(3).max(20),
  country: z.string().min(2).max(100),
});

export const userPreferencesSchema = z.object({
  notifications: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
    })
    .default({
      email: true,
      sms: false,
      push: true,
    }),
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  language: z.string().min(2).max(10).default('en'),
  timezone: z.string().default('UTC'),
});

export const userProfileSchema = z.object({
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: z.string().min(10).max(20).optional(),
  address: addressSchema.optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  occupation: z.string().max(100).optional(),
});

// Extended user profile schema for DynamoDB storage
export const extendedUserProfileSchema = z.object({
  preferences: userPreferencesSchema.deepPartial().optional(),
  addresses: z
    .array(
      addressSchema.extend({
        id: z.string().uuid(),
        label: z.string().max(50),
        isDefault: z.boolean().default(false),
      })
    )
    .default([]),
  paymentMethods: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum(['card', 'bank', 'paypal']),
        label: z.string().max(50),
        lastFour: z.string().length(4),
        isDefault: z.boolean().default(false),
      })
    )
    .default([]),
  businessRole: z.enum(['customer', 'admin']).default('customer'),
});

// API request/response schemas
export const getUserProfileResponseSchema = z.object({
  cognitoSub: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  extendedProfile: extendedUserProfileSchema.optional(),
});

export const updateUserProfileRequestSchema = z.object({
  preferences: userPreferencesSchema.deepPartial().optional(),
  businessRole: z.enum(['customer', 'admin']).optional(),
});

export const addAddressRequestSchema = z.object({
  address: addressSchema,
  label: z.string().min(1).max(50),
  isDefault: z.boolean().default(false),
});

export const updateAddressRequestSchema = addAddressRequestSchema.partial();

export const deleteAddressRequestSchema = z.object({
  addressId: z.string().uuid(),
});

// Path parameter schemas
export const userIdPathSchema = z.object({
  userId: z.string().uuid(),
});

export const addressIdPathSchema = z.object({
  addressId: z.string().uuid(),
});

// Type inference exports
export type Address = z.infer<typeof addressSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ExtendedUserProfile = z.infer<typeof extendedUserProfileSchema>;
export type GetUserProfileResponse = z.infer<typeof getUserProfileResponseSchema>;
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileRequestSchema>;
export type AddAddressRequest = z.infer<typeof addAddressRequestSchema>;
export type UpdateAddressRequest = z.infer<typeof updateAddressRequestSchema>;
export type DeleteAddressRequest = z.infer<typeof deleteAddressRequestSchema>;
