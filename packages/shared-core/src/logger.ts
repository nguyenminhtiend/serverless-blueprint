import pino, { Logger as PinoLogger } from 'pino';

// Optional: Install pino-pretty for development
// pnpm add -D pino-pretty

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  environment?: string;
  version?: string;
  prettyPrint?: boolean;
}

export class Logger {
  private pinoLogger: PinoLogger;
  private service: string;
  private defaultContext: LogContext;

  constructor(service: string, defaultContext: LogContext = {}, options: LoggerOptions = {}) {
    this.service = service;
    this.defaultContext = { service, ...defaultContext };

    const logLevel = options.level || getLogLevel();
    const isProduction = process.env.NODE_ENV === 'production';

    // Configure Pino logger
    this.pinoLogger = pino({
      level: logLevel,
      base: {
        service: this.service,
        environment: options.environment || process.env.ENVIRONMENT || 'development',
        version: options.version || process.env.VERSION || '1.0.0',
        ...this.defaultContext,
      },
      // Use pretty printing in development
      transport:
        !isProduction && options.prettyPrint !== false
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      // AWS Lambda optimizations
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    });
  }

  debug(message: string, context?: LogContext): void {
    this.pinoLogger.debug({ ...this.defaultContext, ...context }, message);
  }

  info(message: string, context?: LogContext): void {
    this.pinoLogger.info({ ...this.defaultContext, ...context }, message);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    const logContext = { ...this.defaultContext, ...context };
    if (error) {
      this.pinoLogger.warn({ ...logContext, err: error }, message);
    } else {
      this.pinoLogger.warn(logContext, message);
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const logContext = { ...this.defaultContext, ...context };
    if (error) {
      this.pinoLogger.error({ ...logContext, err: error }, message);
    } else {
      this.pinoLogger.error(logContext, message);
    }
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    const logContext = { ...this.defaultContext, ...context };
    if (error) {
      this.pinoLogger.fatal({ ...logContext, err: error }, message);
    } else {
      this.pinoLogger.fatal(logContext, message);
    }
  }

  child(additionalContext: LogContext): Logger {
    return new Logger(this.service, { ...this.defaultContext, ...additionalContext });
  }

  // Get the underlying Pino logger for advanced usage
  getPinoLogger(): PinoLogger {
    return this.pinoLogger;
  }

  // Set log level dynamically
  setLevel(level: LogLevel): void {
    this.pinoLogger.level = level;
  }
}

export const createLogger = (
  service: string,
  context?: LogContext,
  options?: LoggerOptions
): Logger => {
  return new Logger(service, context, options);
};

export const getLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  return Object.values(LogLevel).includes(level as LogLevel) ? (level as LogLevel) : LogLevel.INFO;
};

export const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getLogLevel();
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  return levels.indexOf(level) >= levels.indexOf(currentLevel);
};

// Create a default logger instance
export const defaultLogger = createLogger('app');

// Utility functions for common logging patterns
export const logRequest = (logger: Logger, method: string, path: string, context?: LogContext) => {
  logger.info(`${method} ${path}`, { httpMethod: method, path, ...context });
};

export const logResponse = (
  logger: Logger,
  statusCode: number,
  duration: number,
  context?: LogContext
) => {
  logger.info('Request completed', { statusCode, duration, ...context });
};

export const logError = (logger: Logger, error: Error, context?: LogContext) => {
  logger.error('Error occurred', context, error);
};
