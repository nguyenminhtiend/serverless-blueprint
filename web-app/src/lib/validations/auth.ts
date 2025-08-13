/**
 * Authentication validation schemas
 *
 * Note: With OAuth flow, most form validation is handled by Cognito Hosted UI.
 * These schemas are kept minimal for any remaining client-side validation needs.
 */

import { z } from 'zod';

/**
 * OAuth callback validation
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

/**
 * General email validation for any forms that might need it
 */
export const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});

export type OAuthCallbackData = z.infer<typeof oauthCallbackSchema>;
export type EmailFormData = z.infer<typeof emailSchema>;

// Legacy schemas removed - OAuth flow handles validation on Cognito Hosted UI:
// - loginSchema (no longer needed)
// - registerSchema (no longer needed)
// - confirmSignUpSchema (no longer needed)
