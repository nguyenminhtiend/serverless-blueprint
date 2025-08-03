import { APIGatewayProxyResultV2 } from 'aws-lambda';

export const createSuccessResponse = (data: any): APIGatewayProxyResultV2 => {
  if (
    data &&
    typeof data === 'object' &&
    typeof data.statusCode === 'number' &&
    typeof data.body === 'string'
  ) {
    return data;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  };
};

export const ok = (data: any): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const created = (data: any): APIGatewayProxyResultV2 => ({
  statusCode: 201,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const noContent = (): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: { 'Content-Type': 'application/json' },
  body: '',
});