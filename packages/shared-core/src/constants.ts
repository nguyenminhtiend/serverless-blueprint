export const API_VERSION = 'v1'

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const JWT_EXPIRY_TIME = '1h'
export const REFRESH_TOKEN_EXPIRY_TIME = '7d'

export const OTP_LENGTH = 6
export const OTP_EXPIRY_MINUTES = 10

export const EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24
export const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 2

export const MAX_LOGIN_ATTEMPTS = 5
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 15

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const

export const ORDER_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
} as const

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MANAGER: 'MANAGER'
} as const

export const NOTIFICATION_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH'
} as const

export const NOTIFICATION_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const

export const EVENT_SOURCES = {
  USER_SERVICE: 'user-service',
  ORDER_SERVICE: 'order-service',
  AUTH_SERVICE: 'auth-service',
  NOTIFICATION_SERVICE: 'notification-service'
} as const

export const DYNAMODB_CONSTANTS = {
  MAX_BATCH_SIZE: 25,
  MAX_ITEM_SIZE_BYTES: 400 * 1024, // 400KB
  MAX_QUERY_RESULT_SIZE_BYTES: 1024 * 1024, // 1MB
  DEFAULT_GSI_PROJECTION: 'ALL'
} as const

export const LAMBDA_CONSTANTS = {
  MAX_TIMEOUT_SECONDS: 900, // 15 minutes
  MAX_MEMORY_MB: 10240, // 10GB
  DEFAULT_MEMORY_MB: 512,
  DEFAULT_TIMEOUT_SECONDS: 30
} as const

export const API_GATEWAY_CONSTANTS = {
  MAX_REQUEST_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_RESPONSE_SIZE_BYTES: 6 * 1024 * 1024, // 6MB
  DEFAULT_TIMEOUT_SECONDS: 29
} as const

export const CORS_DEFAULT = {
  ALLOWED_ORIGINS: ['http://localhost:3000', 'https://app.example.com'],
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
  EXPOSED_HEADERS: ['X-Total-Count', 'X-Page-Size'],
  MAX_AGE_SECONDS: 86400 // 24 hours
} as const

export const RATE_LIMITS = {
  DEFAULT_REQUESTS_PER_MINUTE: 100,
  AUTH_REQUESTS_PER_MINUTE: 10,
  REGISTRATION_REQUESTS_PER_HOUR: 5,
  PASSWORD_RESET_REQUESTS_PER_HOUR: 3
} as const

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  ZIP_CODE: /^\d{5}(-\d{4})?$/,
  CREDIT_CARD: /^\d{13,19}$/,
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
} as const