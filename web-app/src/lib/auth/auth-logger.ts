/**
 * Structured authentication logging utility
 * Provides consistent, secure logging for auth operations
 */

import type { AuthError } from './oauth-types';

/**
 * Log levels for authentication events
 */
export enum AuthLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Authentication event types
 */
export enum AuthEventType {
  LOGIN_INITIATED = 'login_initiated',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT_INITIATED = 'logout_initiated',
  LOGOUT_SUCCESS = 'logout_success',
  TOKEN_REFRESH_SUCCESS = 'token_refresh_success',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  SESSION_EXPIRED = 'session_expired',
  PKCE_SESSION_CREATED = 'pkce_session_created',
  PKCE_SESSION_VALIDATED = 'pkce_session_validated',
  PKCE_SESSION_INVALID = 'pkce_session_invalid',
  CSRF_ATTACK_DETECTED = 'csrf_attack_detected',
  SECURITY_VIOLATION = 'security_violation',
}

/**
 * Structured log entry for authentication events
 */
interface AuthLogEntry {
  timestamp: string;
  level: AuthLogLevel;
  eventType: AuthEventType;
  message: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Authentication logger class with structured logging
 */
class AuthLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logToConsole = this.isDevelopment || process.env.AUTH_LOGGING_ENABLED === 'true';

  /**
   * Logs authentication events with structured data
   */
  private log(
    level: AuthLogLevel,
    eventType: AuthEventType,
    message: string,
    metadata?: Record<string, unknown>,
    error?: AuthError | Error,
    request?: Request | { headers: { get: (name: string) => string | null } },
  ): void {
    const logEntry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      eventType,
      message,
      metadata: this.sanitizeMetadata(metadata || {}),
    };

    // Add request context if available
    if (request) {
      logEntry.userAgent = request.headers.get('user-agent') || undefined;
      logEntry.requestId = request.headers.get('x-request-id') || undefined;
      // Note: IP address extraction depends on your deployment setup
    }

    // Add error details if present
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        code: 'code' in error ? error.code : undefined,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    // Output the log
    if (this.logToConsole) {
      this.outputToConsole(logEntry);
    }

    // In production, you might want to send to external logging service
    if (!this.isDevelopment) {
      this.outputToExternalService(logEntry);
    }
  }

  /**
   * Removes sensitive data from metadata
   */
  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'code_verifier',
      'authorization_code',
      'refresh_token',
      'access_token',
      'id_token',
    ];

    const sanitized: Record<string, unknown> = {};

    Object.entries(metadata).forEach(([key, value]) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = `${value.substring(0, 100)}... [TRUNCATED]`;
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Outputs log to console with proper formatting
   */
  private outputToConsole(logEntry: AuthLogEntry): void {
    const { level, eventType, message, metadata, error } = logEntry;
    const logMethod =
      level === AuthLogLevel.ERROR
        ? console.error
        : level === AuthLogLevel.WARN
          ? console.warn
          : level === AuthLogLevel.DEBUG
            ? console.debug
            : console.log;

    logMethod(`[AUTH:${eventType}] ${message}`, {
      ...metadata,
      error,
      timestamp: logEntry.timestamp,
    });
  }

  /**
   * Outputs log to external service (placeholder)
   */
  private outputToExternalService(logEntry: AuthLogEntry): void {
    // In production, implement logging to your preferred service:
    // - CloudWatch Logs
    // - Datadog
    // - Sentry
    // - etc.

    // For now, just ensure it doesn't throw
    try {
      // Example: send to external logging endpoint
      // await fetch('/api/logs', { method: 'POST', body: JSON.stringify(logEntry) });
    } catch (error) {
      // Silently fail to avoid breaking auth flow
      console.error('Failed to send log to external service:', error);
    }
  }

  /**
   * Debug level logging
   */
  debug(eventType: AuthEventType, message: string, metadata?: Record<string, unknown>): void {
    this.log(AuthLogLevel.DEBUG, eventType, message, metadata);
  }

  /**
   * Info level logging
   */
  info(eventType: AuthEventType, message: string, metadata?: Record<string, unknown>): void {
    this.log(AuthLogLevel.INFO, eventType, message, metadata);
  }

  /**
   * Warning level logging
   */
  warn(eventType: AuthEventType, message: string, metadata?: Record<string, unknown>): void {
    this.log(AuthLogLevel.WARN, eventType, message, metadata);
  }

  /**
   * Error level logging
   */
  error(
    eventType: AuthEventType,
    message: string,
    error?: AuthError | Error,
    metadata?: Record<string, unknown>,
    request?: Request | { headers: { get: (name: string) => string | null } },
  ): void {
    this.log(AuthLogLevel.ERROR, eventType, message, metadata, error, request);
  }

  /**
   * Logs successful authentication events
   */
  logAuthSuccess(
    eventType: AuthEventType,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.info(eventType, 'Authentication operation completed successfully', {
      userId,
      ...metadata,
    });
  }

  /**
   * Logs authentication failures with security context
   */
  logAuthFailure(
    eventType: AuthEventType,
    error: AuthError | Error,
    metadata?: Record<string, unknown>,
    request?: Request | { headers: { get: (name: string) => string | null } },
  ): void {
    this.error(eventType, 'Authentication operation failed', error, metadata, request);
  }

  /**
   * Logs security violations with high priority
   */
  logSecurityViolation(
    message: string,
    metadata?: Record<string, unknown>,
    request?: Request | { headers: { get: (name: string) => string | null } },
  ): void {
    this.error(
      AuthEventType.SECURITY_VIOLATION,
      message,
      undefined,
      {
        priority: 'HIGH',
        ...metadata,
      },
      request,
    );
  }
}

/**
 * Singleton auth logger instance
 */
export const authLogger = new AuthLogger();

/**
 * Convenience function for logging auth errors
 */
export function logAuthError(
  eventType: AuthEventType,
  error: AuthError | Error,
  metadata?: Record<string, unknown>,
): void {
  authLogger.logAuthFailure(eventType, error, metadata);
}

/**
 * Convenience function for logging auth success
 */
export function logAuthSuccess(eventType: AuthEventType, metadata?: Record<string, unknown>): void {
  authLogger.logAuthSuccess(eventType, undefined, metadata);
}
