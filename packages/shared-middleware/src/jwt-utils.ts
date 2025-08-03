import { APIGatewayProxyEventV2WithJWTAuthorizer, JWTClaims } from './types';
import { HttpError } from './errors';

export const getJWTClaims = (event: APIGatewayProxyEventV2WithJWTAuthorizer): JWTClaims | null => {
  return event.requestContext.authorizer?.jwt?.claims || null;
};

export const getJWTClaim = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer, 
  claimName: string
): string | number | boolean | undefined => {
  const claims = getJWTClaims(event);
  return claims?.[claimName];
};

export const getUserId = (event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined => {
  const sub = getJWTClaim(event, 'sub');
  return typeof sub === 'string' ? sub : undefined;
};

export const getUserEmail = (event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined => {
  const email = getJWTClaim(event, 'email');
  return typeof email === 'string' ? email : undefined;
};

export const requireJWTClaims = (event: APIGatewayProxyEventV2WithJWTAuthorizer): JWTClaims => {
  const claims = getJWTClaims(event);
  if (!claims) {
    throw new HttpError(401, 'JWT claims not found in request context');
  }
  return claims;
};

export const requireUserId = (event: APIGatewayProxyEventV2WithJWTAuthorizer): string => {
  const userId = getUserId(event);
  if (!userId) {
    throw new HttpError(401, 'User ID (sub claim) not found in JWT');
  }
  return userId;
};