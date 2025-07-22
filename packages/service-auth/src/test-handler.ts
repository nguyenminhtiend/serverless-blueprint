import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const simpleHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      message: 'Simple handler working',
      path: event.path,
      method: event.httpMethod,
    }),
  };
};