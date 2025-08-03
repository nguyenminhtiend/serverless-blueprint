import { Logger } from '@aws-lambda-powertools/logger';

export function createLogger(
  service: string,
  context: Record<string, any> = {},
  options: { level?: string; environment?: string; version?: string } = {}
): Logger {
  const {
    level = 'INFO',
    environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev',
    version = process.env.VERSION || '1.0.0',
  } = options;

  return new Logger({
    serviceName: service,
    logLevel: level as any,
    persistentLogAttributes: {
      environment,
      version,
      ...context,
    },
  });
}
