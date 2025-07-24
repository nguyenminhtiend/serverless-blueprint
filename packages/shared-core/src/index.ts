// Constants
export * from './constants';

// Date utilities
export * from './date';

// Error handling
export * from './errors';

// Event Publisher
export * from './event-publisher';

// Unified logger with Pino + CloudWatch metrics (replaces both logger.ts and metrics-logger.ts)
export {
  LogLevel,
  LogContext,
  Logger,
  LoggerOptions,
  MetricOptions,
  createLogger,
  withMonitoring,
  defaultLogger,
  getLogLevel,
  logError,
  logRequest,
  logResponse,
  shouldLog,
} from './unified-logger';

// Legacy aliases for backward compatibility
export {
  LogContext as PinoLogContext,
  Logger as PinoLogger,
  LoggerOptions as PinoLoggerOptions,
  createLogger as createPinoLogger,
  Logger as MetricsLogger,
  LoggerOptions as MetricsLoggerOptions,
} from './unified-logger';

// X-Ray tracing utilities - REMOVED (not used by any services)
// Basic X-Ray tracing works automatically at Lambda level

// Utilities
export * from './utils';

// Validation
export * from './validation';
