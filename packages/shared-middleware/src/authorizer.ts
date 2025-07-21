import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('JWT Authorizer - event:', JSON.stringify(event, null, 2));

  // Placeholder authorizer - allows all requests
  // TODO: Implement proper JWT validation in later phases

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      isAuthorized: true,
      context: {
        userId: 'placeholder-user-id',
        email: 'placeholder@example.com',
      },
    }),
  };
};
