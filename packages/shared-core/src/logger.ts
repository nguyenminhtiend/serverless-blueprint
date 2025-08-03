import pino, { Logger as PinoLogger } from 'pino';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
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
  private defaultContext: LogContext;

  constructor(service: string, context: LogContext = {}, options: LoggerOptions = {}) {
    const {
      level = LogLevel.INFO,
      environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev',
      version = process.env.VERSION || '1.0.0',
      prettyPrint = false,
    } = options;

    this.defaultContext = {
      service,
      environment,
      version,
      ...context,
    };

    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const usePrettyPrint = !isLambda && prettyPrint;

    this.pinoLogger = pino({
      level,
      formatters: {
        level: label => ({ level: label }),
      },
      transport: usePrettyPrint
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'hostname',
            },
          }
        : undefined,
      base: this.defaultContext,
    });
  }

  trace(message: string, context?: LogContext): void {
    this.pinoLogger.trace({ ...this.defaultContext, ...context }, message);
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

  child(context: LogContext): Logger {
    const childLogger = new Logger(
      this.defaultContext.service as string,
      { ...this.defaultContext, ...context },
      {
        level: this.pinoLogger.level as LogLevel,
        prettyPrint: false,
        environment: this.defaultContext.environment as string,
      }
    );
    return childLogger;
  }

  setLevel(level: LogLevel): void {
    this.pinoLogger.level = level;
  }

  get level(): string {
    return this.pinoLogger.level;
  }
}

export function createLogger(
  service: string,
  context: LogContext = {},
  options: LoggerOptions = {}
): Logger {
  return new Logger(service, context, options);
}
