import { UUID, Email } from './common'
import { UserRole } from './user'

// JWT token types
export interface JwtPayload {
  sub: UUID // User ID
  email: Email
  roles: UserRole[]
  iat: number
  exp: number
  iss: string
  aud: string
}

// Authentication request/response types
export interface LoginRequest {
  email: Email
  password: string
  rememberMe?: boolean
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: UUID
    email: Email
    firstName: string
    lastName: string
    roles: UserRole[]
  }
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
}

// Registration types
export interface RegisterRequest {
  email: Email
  password: string
  firstName: string
  lastName: string
  acceptTerms: boolean
}

export interface RegisterResponse {
  userId: UUID
  email: Email
  message: string
  verificationRequired: boolean
}

// Password reset types
export interface ForgotPasswordRequest {
  email: Email
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

// Email verification types
export interface VerifyEmailRequest {
  token: string
}

export interface ResendVerificationRequest {
  email: Email
}

// Session types
export interface UserSession {
  userId: UUID
  sessionId: string
  createdAt: string
  expiresAt: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
}

// Permission types
export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface RolePermissions {
  role: UserRole
  permissions: Permission[]
}

// Auth middleware context
export interface AuthContext {
  user: {
    id: UUID
    email: Email
    roles: UserRole[]
  }
  permissions: Permission[]
  sessionId: string
}