import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@shared/core';
import { createCognitoService, createUserProfileService } from '../services';
import { getUserProfileResponseSchema } from '../schemas';

const logger = createLogger('get-user-profile');

/**
 * Get user profile handler - combines Cognito data with extended DynamoDB profile
 */
export const getUserProfileHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT (added by API Gateway JWT authorizer)
    const userContext = event.requestContext.authorizer;
    if (!userContext || !userContext.claims) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const cognitoSub = userContext.claims.sub;
    if (!cognitoSub) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user identifier' }),
      };
    }

    logger.info('Getting user profile', { cognitoSub });

    // Get services
    const cognitoService = createCognitoService();
    const userProfileService = createUserProfileService();

    // Get Cognito user data (basic profile)
    const cognitoUser = await cognitoService.getUserByUsername(cognitoSub);

    // Get extended profile from DynamoDB
    const extendedProfile = await userProfileService.getUserProfile(cognitoSub);

    // Combine data
    const userProfile = {
      cognitoSub: cognitoUser.cognitoSub,
      email: cognitoUser.email,
      firstName: cognitoUser.firstName,
      lastName: cognitoUser.lastName,
      extendedProfile,
    };

    // Validate response schema
    const validatedProfile = getUserProfileResponseSchema.parse(userProfile);

    logger.info('User profile retrieved successfully', { cognitoSub });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: validatedProfile,
      }),
    };
  } catch (error) {
    logger.error('Failed to get user profile', { error });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to retrieve user profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
