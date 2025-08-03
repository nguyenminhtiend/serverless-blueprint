import { APIGatewayProxyResultV2 } from 'aws-lambda';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const createErrorResponse = (error: any): APIGatewayProxyResultV2 => {
  console.error('Lambda execution error:', error);

  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }),
  };
};

export const badRequest = (message: string, details?: any): never => {
  throw new HttpError(400, message, details);
};

export const unauthorized = (message: string = 'Unauthorized'): never => {
  throw new HttpError(401, message);
};

export const forbidden = (message: string = 'Forbidden'): never => {
  throw new HttpError(403, message);
};

export const notFound = (message: string = 'Not found'): never => {
  throw new HttpError(404, message);
};

export const conflict = (message: string, details?: any): never => {
  throw new HttpError(409, message, details);
};

export const internalError = (message: string = 'Internal server error', details?: any): never => {
  throw new HttpError(500, message, details);
};