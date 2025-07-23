import { createLogger } from '@shared/core';
import { extractUserOrError, UserContext } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserProfileResponseSchema } from '../schemas';
import { createCognitoService, createUserProfileService } from '../services';

const logger = createLogger('get-user-profile');

/**
 * Get User Profile Handler - Retrieves user profile from both Cognito and DynamoDB
 */
export const getUserProfileHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context or return error
    const userResult = extractUserOrError(event);
    if ('statusCode' in userResult) {
      return userResult; // Return error response
    }
    const { userId: cognitoSub } = userResult as UserContext;

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
