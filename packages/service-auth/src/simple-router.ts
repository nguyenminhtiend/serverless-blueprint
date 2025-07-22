import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Transform HTTP API v2.0 event to v1.0 format for compatibility
function transformEventToV1(event: any): APIGatewayProxyEvent {
  if (event.version === '2.0') {
    return {
      ...event,
      httpMethod: event.requestContext.http.method,
      path: event.rawPath,
      pathParameters: event.pathParameters || null,
      queryStringParameters: event.queryStringParameters || null,
      headers: event.headers || {},
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        ...event.requestContext,
        httpMethod: event.requestContext.http.method,
        path: event.rawPath,
        resourcePath: event.rawPath,
        resourceId: 'resource-id',
        protocol: event.requestContext.http.protocol,
        identity: {
          sourceIp: event.requestContext.http.sourceIp,
          userAgent: event.requestContext.http.userAgent,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          user: null,
          caller: null,
          accessKey: null,
          accountId: event.requestContext.accountId,
          apiKey: null,
          apiKeyId: null,
          principalOrgId: null,
        }
      },
      resource: event.rawPath,
      isBase64Encoded: event.isBase64Encoded || false,
      body: event.body
    } as APIGatewayProxyEvent;
  }
  return event as APIGatewayProxyEvent;
}
import {
  loginHandler,
  registerHandler,
  confirmSignUpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from './handlers/auth';

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  // Transform event to v1.0 format for handler compatibility
  const transformedEvent = transformEventToV1(event);
  const { httpMethod, path } = transformedEvent;
  
  // Simple routing based on path and method
  const route = `${httpMethod} ${path}`;
  
  try {
    switch (route) {
      case 'POST /auth/login':
        return await loginHandler(transformedEvent);
      
      case 'POST /auth/register':
        return await registerHandler(transformedEvent);
      
      case 'POST /auth/confirm-signup':
        return await confirmSignUpHandler(transformedEvent);
      
      case 'POST /auth/forgot-password':
        return await forgotPasswordHandler(transformedEvent);
      
      case 'POST /auth/reset-password':
        return await resetPasswordHandler(transformedEvent);
      
      case 'GET /health':
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            service: 'auth-service',
            timestamp: new Date().toISOString(),
            availableRoutes: [
              'POST /auth/login',
              'POST /auth/register', 
              'POST /auth/confirm-signup',
              'POST /auth/forgot-password',
              'POST /auth/reset-password'
            ]
          })
        };
      
      default:
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Route not found',
            route,
            availableRoutes: [
              'POST /auth/login',
              'POST /auth/register',
              'POST /auth/confirm-signup', 
              'POST /auth/forgot-password',
              'POST /auth/reset-password'
            ]
          })
        };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};