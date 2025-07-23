import { CloudWatchClient, MetricDatum, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import pino, { Logger } from 'pino';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface MetricsLoggerOptions {
  level?: LogLevel;
  prettyPrint?: boolean;
  service?: string;
  environment?: string;
  enableMetrics?: boolean;
}

export interface MetricOptions {
  unit?: string;
  dimensions?: Record<string, string>;
  namespace?: string;
}

export class MetricsLogger {
  private logger: Logger;
  private cloudWatch?: CloudWatchClient;
  private defaultNamespace: string;
  private defaultDimensions: Record<string, string>;
  private metricsEnabled: boolean;

  constructor(
    service: string,
    context: Record<string, any> = {},
    options: MetricsLoggerOptions = {}
  ) {
    const {
      level = LogLevel.INFO,
      prettyPrint = process.env.NODE_ENV !== 'production',
      environment = process.env.ENVIRONMENT || 'dev',
      enableMetrics = true,
    } = options;

    // Initialize Pino logger
    this.logger = pino({
      level,
      formatters: {
        level: label => ({ level: label }),
      },
      transport: prettyPrint
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'hostname',
            },
          }
        : undefined,
      base: {
        service,
        environment,
        ...context,
      },
    });

    // Initialize CloudWatch client for metrics
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

  // Standard logging methods
  trace(message: string, meta?: Record<string, any>) {
    this.logger.trace(meta, message);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(meta, message);
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(meta, message);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(meta, message);
  }

  error(message: string, meta?: Record<string, any>, error?: Error) {
    if (error) {
      this.logger.error({ ...meta, err: error }, message);
    } else {
      this.logger.error(meta, message);
    }
  }

  fatal(message: string, meta?: Record<string, any>, error?: Error) {
    if (error) {
      this.logger.fatal({ ...meta, err: error }, message);
    } else {
      this.logger.fatal(meta, message);
    }
  }

  // Enhanced logging with automatic metric emission
  logWithMetric(
    level: LogLevel,
    message: string,
    metricName: string,
    metricValue: number = 1,
    meta?: Record<string, any>,
    metricOptions?: MetricOptions
  ) {
    // Log the message
    this.logger[level](meta, message);

    // Emit metric
    this.emit(metricName, metricValue, metricOptions);
  }

  // Performance timing
  timing(operation: string, duration: number, meta?: Record<string, any>) {
    this.info(`Performance: ${operation}`, {
      ...meta,
      operation,
      duration,
      type: 'timing',
    });

    this.emit(`${operation}.Duration`, duration, {
      unit: 'Milliseconds',
      dimensions: { Operation: operation },
    });
  }

  // Business metrics
  businessMetric(
    metricName: string,
    value: number,
    meta?: Record<string, any>,
    options?: MetricOptions
  ) {
    this.info(`Business Metric: ${metricName}`, {
      ...meta,
      metricName,
      value,
      type: 'business',
    });

    this.emit(metricName, value, options);
  }

  // Counter increment
  increment(metricName: string, value: number = 1, meta?: Record<string, any>) {
    this.info(`Counter: ${metricName}`, {
      ...meta,
      metricName,
      value,
      type: 'counter',
    });

    this.emit(metricName, value, { unit: 'Count' });
  }

  // Success/failure tracking
  success(operation: string, meta?: Record<string, any>) {
    this.info(`Success: ${operation}`, { ...meta, operation, result: 'success' });
    this.emit(`${operation}.Success`, 1, { unit: 'Count' });
  }

  failure(operation: string, error?: Error, meta?: Record<string, any>) {
    this.error(`Failure: ${operation}`, { ...meta, operation, result: 'failure' }, error);
    this.emit(`${operation}.Failure`, 1, { unit: 'Count' });
  }

  // Emit custom metric to CloudWatch
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
      // Log metric emission failure but don't throw
      this.logger.warn('Failed to emit CloudWatch metric', {
        metricName,
        value,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Memory usage tracking
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

      this.emit('MemoryUtilization', memoryUtilization, {
        unit: 'Percent',
        dimensions: {
          FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        },
      });
    }
  }

  // Request correlation
  child(context: Record<string, any>): MetricsLogger {
    const childLogger = new MetricsLogger(
      this.defaultDimensions.Service,
      { ...this.logger.bindings(), ...context },
      {
        level: this.logger.level as LogLevel,
        prettyPrint: false, // Child loggers don't need pretty print
        environment: this.defaultDimensions.Environment,
        enableMetrics: this.metricsEnabled,
      }
    );

    // Share CloudWatch client
    childLogger.cloudWatch = this.cloudWatch;
    childLogger.defaultNamespace = this.defaultNamespace;
    childLogger.defaultDimensions = { ...this.defaultDimensions, ...context };

    return childLogger;
  }
}

// Factory function for creating loggers
export function createLogger(
  service: string,
  context: Record<string, any> = {},
  options: MetricsLoggerOptions = {}
): MetricsLogger {
  return new MetricsLogger(service, context, options);
}

// Performance decorator for timing function execution
export function withTiming<T extends (...args: any[]) => any>(
  logger: MetricsLogger,
  operation: string
) {
  return function (target: any, propertyName: string, descriptor: TypedPropertyDescriptor<T>) {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const start = Date.now();

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;

        logger.timing(operation, duration, {
          method: propertyName,
          success: true,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - start;

        logger.timing(operation, duration, {
          method: propertyName,
          success: false,
        });

        throw error;
      }
    } as T;

    return descriptor;
  };
}

// Lambda function wrapper with automatic monitoring
export function withMonitoring<TEvent = any, TResult = any>(
  handler: (event: TEvent, context: any, logger: MetricsLogger) => Promise<TResult>,
  serviceName: string
) {
  return async (event: TEvent, context: any): Promise<TResult> => {
    const logger = createLogger(serviceName, {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
    });

    const start = Date.now();

    try {
      // Track memory at start
      logger.trackMemoryUsage();

      // Execute handler
      const result = await handler(event, context, logger);

      // Track success metrics
      const duration = Date.now() - start;
      logger.timing('HandlerExecution', duration);
      logger.success('HandlerExecution');

      return result;
    } catch (error) {
      // Track failure metrics
      const duration = Date.now() - start;
      logger.timing('HandlerExecution', duration);
      logger.failure('HandlerExecution', error instanceof Error ? error : new Error(String(error)));

      throw error;
    } finally {
      // Track final memory usage
      logger.trackMemoryUsage();
    }
  };
}
