import * as AWS from 'aws-sdk';
import type { Subsegment } from 'aws-xray-sdk-core';
import AWSXRay from 'aws-xray-sdk-core';
import * as http from 'http';
import * as https from 'https';
import { MetricsLogger } from './metrics-logger';

// Configure X-Ray SDK
export const configureXRay = () => {
  // Enable X-Ray for AWS SDK calls
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    AWSXRay.captureAWS(AWS);

    // Configure X-Ray to capture HTTP requests
    AWSXRay.captureHTTPsGlobal(http);
    AWSXRay.captureHTTPsGlobal(https);
  }
};

// Create subsegment for custom operations
export const createSubsegment = (name: string, operation: () => Promise<any>) => {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return operation();
  }

  return new Promise((resolve, reject) => {
    AWSXRay.captureAsyncFunc(name, async (subsegment: Subsegment | undefined) => {
      try {
        const result = await operation();
        subsegment?.close();
        resolve(result);
      } catch (error) {
        subsegment?.addError(error as Error);
        subsegment?.close();
        reject(error);
      }
    });
  });
};

// Add custom annotations and metadata
export const addTraceAnnotations = (annotations: Record<string, string | number>) => {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const segment = AWSXRay.getSegment();
    if (segment) {
      Object.entries(annotations).forEach(([key, value]) => {
        segment.addAnnotation(key, value);
      });
    }
  }
};

export const addTraceMetadata = (metadata: Record<string, any>) => {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const segment = AWSXRay.getSegment();
    if (segment) {
      Object.entries(metadata).forEach(([key, value]) => {
        segment.addMetadata(key, value);
      });
    }
  }
};

// Enhanced Lambda wrapper with X-Ray tracing and monitoring
export const withTracingAndMonitoring = <TEvent = any, TResult = any>(
  handler: (event: TEvent, context: any, logger: MetricsLogger) => Promise<TResult>,
  serviceName: string,
  operationName?: string
) => {
  // Configure X-Ray once
  configureXRay();

  return async (event: TEvent, context: any): Promise<TResult> => {
    const logger = new MetricsLogger(serviceName, {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
    });

    const start = Date.now();
    const operation = operationName || context.functionName || 'handler';

    try {
      // Add X-Ray annotations
      addTraceAnnotations({
        service: serviceName,
        operation,
        requestId: context.awsRequestId,
      });

      // Add trace metadata
      addTraceMetadata({
        event: typeof event === 'object' ? JSON.stringify(event) : event,
        environment: process.env.ENVIRONMENT || 'dev',
      });

      // Track memory at start
      logger.trackMemoryUsage();

      // Execute handler with X-Ray subsegment
      const result = await createSubsegment(`${serviceName}.${operation}`, async () => {
        return handler(event, context, logger);
      });

      // Track success metrics
      const duration = Date.now() - start;
      logger.timing(operation, duration);
      logger.success(operation);

      // Add success annotation
      addTraceAnnotations({ success: 1 });

      return result;
    } catch (error) {
      // Track failure metrics
      const duration = Date.now() - start;
      logger.timing(operation, duration);
      logger.failure(operation, error instanceof Error ? error : new Error(String(error)));

      // Add failure annotation
      addTraceAnnotations({ success: 0, error: 1 });

      throw error;
    } finally {
      // Track final memory usage
      logger.trackMemoryUsage();
    }
  };
};

// Decorator for tracing class methods
export function traced(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return originalMethod.apply(this, args);
      }

      return createSubsegment(operation, async () => {
        addTraceAnnotations({
          class: target.constructor.name,
          method: propertyName,
        });

        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Database operation tracing
export const traceDatabaseOperation = async <T>(
  operation: string,
  tableName: string,
  operation_func: () => Promise<T>
): Promise<T> => {
  return createSubsegment(`DynamoDB.${operation}`, async () => {
    addTraceAnnotations({
      operation,
      tableName,
      service: 'DynamoDB',
    });

    const start = Date.now();
    try {
      const result = await operation_func();
      const duration = Date.now() - start;

      addTraceMetadata({
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      addTraceMetadata({
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });
};

// HTTP request tracing
export const traceHttpRequest = async <T>(
  method: string,
  url: string,
  request_func: () => Promise<T>
): Promise<T> => {
  return createSubsegment(`HTTP.${method}`, async () => {
    addTraceAnnotations({
      method,
      url: new URL(url).hostname, // Don't include full URL for security
      service: 'HTTP',
    });

    const start = Date.now();
    try {
      const result = await request_func();
      const duration = Date.now() - start;

      addTraceMetadata({
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      addTraceMetadata({
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });
};
