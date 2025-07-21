import { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerResult> => {
  console.log('JWT Authorizer - event:', JSON.stringify(event, null, 2));

  // Placeholder authorizer - allows all requests
  // TODO: Implement proper JWT validation in later phases

  const authorizationToken = event.headers?.authorization || event.headers?.Authorization;

  if (!authorizationToken) {
    throw new Error('Unauthorized'); // This will return 401
  }

  // For HTTP API v2 Simple Authorizer, we return a simple response
  return {
    isAuthorized: true,
  };
};
