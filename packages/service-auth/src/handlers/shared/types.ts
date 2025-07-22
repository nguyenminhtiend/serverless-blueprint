import { z } from 'zod';

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthChallenge {
  challenge: boolean;
  challengeName: string;
  session: string;
  challengeParameters: Record<string, string>;
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
});

export const confirmSignUpSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(6).max(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(6).max(6),
  newPassword: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ConfirmSignUpInput = z.infer<typeof confirmSignUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
