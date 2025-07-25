import { CloudWatchClient, MetricDatum, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
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
  enableMetrics?: boolean;
}

export interface MetricOptions {
  unit?: string;
  dimensions?: Record<string, string>;
  namespace?: string;
}

/**
 * Unified Logger that combines Pino structured logging with optional CloudWatch metrics
 * Replaces both the legacy logger and MetricsLogger
 */
export class Logger {
  private pinoLogger: PinoLogger;
  private cloudWatch?: CloudWatchClient;
  private defaultNamespace: string;
  private defaultDimensions: Record<string, string>;
  private metricsEnabled: boolean;
  private defaultContext: LogContext;

  constructor(service: string, context: LogContext = {}, options: LoggerOptions = {}) {
    const {
      level = LogLevel.INFO,
      environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev',
      version = process.env.VERSION || '1.0.0',
      prettyPrint = false, // Always false - pino-pretty not suitable for Lambda
      enableMetrics = false, // Default disabled for dev cost optimization
    } = options;

    // Store default context for legacy compatibility
    this.defaultContext = {
      service,
      environment,
      version,
      ...context,
    };

    // Initialize Pino logger
    // Force disable prettyPrint in Lambda environments
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

    // Initialize CloudWatch client for metrics (optional)
    this.metricsEnabled = enableMetrics && process.env.NODE_ENV !== 'test';
    if (this.metricsEnabled) {
      this.cloudWatch = new CloudWatchClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
    }

    this.defaultNamespace = `ServerlessMicroservices/${service}`;
    this.defaultDimensions = {
      Service: service,
      Environment: environment,
    };
  }

  // Legacy Pino-style methods (for backward compatibility)
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

  // Enhanced monitoring methods (from MetricsLogger)

  /**
   * Log with automatic metric emission
   */
  logWithMetric(
    level: LogLevel,
    message: string,
    metricName: string,
    metricValue: number = 1,
    context?: LogContext,
    metricOptions?: MetricOptions
  ) {
    // Log the message
    this.pinoLogger[level]({ ...this.defaultContext, ...context }, message);

    // Emit metric if enabled
    if (this.metricsEnabled) {
      this.emit(metricName, metricValue, metricOptions);
    }
  }

  /**
   * Performance timing with optional metrics
   */
  timing(operation: string, duration: number, context?: LogContext) {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      type: 'timing',
    });

    if (this.metricsEnabled) {
      this.emit(`${operation}.Duration`, duration, {
        unit: 'Milliseconds',
        dimensions: { Operation: operation },
      });
    }
  }

  /**
   * Business metrics logging
   */
  businessMetric(metricName: string, value: number, context?: LogContext, options?: MetricOptions) {
    this.info(`Business Metric: ${metricName}`, {
      ...context,
      metricName,
      value,
      type: 'business',
    });

    if (this.metricsEnabled) {
      this.emit(metricName, value, options);
    }
  }

  /**
   * Counter increment
   */
  increment(metricName: string, value: number = 1, context?: LogContext) {
    this.info(`Counter: ${metricName}`, {
      ...context,
      metricName,
      value,
      type: 'counter',
    });

    if (this.metricsEnabled) {
      this.emit(metricName, value, { unit: 'Count' });
    }
  }

  /**
   * Success/failure tracking
   */
  success(operation: string, context?: LogContext) {
    this.info(`Success: ${operation}`, { ...context, operation, result: 'success' });
    if (this.metricsEnabled) {
      this.emit(`${operation}.Success`, 1, { unit: 'Count' });
    }
  }

  failure(operation: string, error?: Error, context?: LogContext) {
    this.error(`Failure: ${operation}`, { ...context, operation, result: 'failure' }, error);
    if (this.metricsEnabled) {
      this.emit(`${operation}.Failure`, 1, { unit: 'Count' });
    }
  }

  /**
   * Memory usage tracking (Lambda-specific)
   */
  trackMemoryUsage() {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const used = process.memoryUsage();
      const totalMemory =
        parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '128') * 1024 * 1024;
      const memoryUtilization = (used.heapUsed / totalMemory) * 100;

      this.info('Memory Usage', {
        heapUsed: used.heapUsed,
        heapTotal: used.heapTotal,
        totalMemory,
        memoryUtilization: Math.round(memoryUtilization * 100) / 100,
      });

      if (this.metricsEnabled) {
        this.emit('MemoryUtilization', memoryUtilization, {
          unit: 'Percent',
          dimensions: {
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          },
        });
      }
    }
  }

  /**
   * Emit custom metric to CloudWatch (only if metrics enabled)
   */
  async emit(metricName: string, value: number, options: MetricOptions = {}): Promise<void> {
    if (!this.metricsEnabled || !this.cloudWatch) {
      return;
    }

    const { unit = 'Count', dimensions = {}, namespace = this.defaultNamespace } = options;

    const metricData: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit as any,
      Timestamp: new Date(),
      Dimensions: Object.entries({
        ...this.defaultDimensions,
        ...dimensions,
      }).map(([Name, Value]) => ({ Name, Value })),
    };

    try {
      await this.cloudWatch.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: [metricData],
        })
      );
    } catch (error) {
      // Log metric emission failure but don't throw (graceful degradation)
      this.pinoLogger.warn('Failed to emit CloudWatch metric', {
        metricName,
        value,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(
      this.defaultDimensions.Service,
      { ...this.defaultContext, ...context },
      {
        level: this.pinoLogger.level as LogLevel,
        prettyPrint: false, // Child loggers don't need pretty print
        environment: this.defaultDimensions.Environment,
        enableMetrics: this.metricsEnabled,
      }
    );

    // Share CloudWatch client
    childLogger.cloudWatch = this.cloudWatch;
    childLogger.defaultNamespace = this.defaultNamespace;

    // Convert context to string dimensions for CloudWatch
    const stringDimensions: Record<string, string> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        stringDimensions[key] = String(value);
      }
    });
    childLogger.defaultDimensions = { ...this.defaultDimensions, ...stringDimensions };

    return childLogger;
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.pinoLogger.level = level;
  }

  /**
   * Get current log level
   */
  get level(): string {
    return this.pinoLogger.level;
  }
}

// Factory function for creating loggers
export function createLogger(
  service: string,
  context: LogContext = {},
  options: LoggerOptions = {}
): Logger {
  return new Logger(service, context, options);
}
