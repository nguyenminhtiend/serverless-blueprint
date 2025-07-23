import { createLogger } from '@shared/core';
import { parseValidatedBody } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateUserProfileRequest, updateUserProfileRequestSchema } from '../schemas';
import { createUserProfileService } from '../services';

const logger = createLogger('update-user-profile');

/**
 * Update user profile handler - updates extended profile data in DynamoDB
 */
export const updateUserProfileHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT (added by API Gateway JWT authorizer)
    const userContext = event.requestContext.authorizer;
    if (!userContext || !userContext.jwt || !userContext.jwt.claims) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const cognitoSub = userContext.jwt.claims.sub;
    if (!cognitoSub) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user identifier' }),
      };
    }

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    // Body is already parsed by middleware, just validate
    const updateData = parseValidatedBody<UpdateUserProfileRequest>(
      event,
      updateUserProfileRequestSchema
    );

    logger.info('Updating user profile', { cognitoSub, updates: Object.keys(updateData) });

    // Get user profile service
    const userProfileService = createUserProfileService();

    // Update profile
    const updatedProfile = await userProfileService.updateUserProfile(cognitoSub, updateData);

    logger.info('User profile updated successfully', { cognitoSub });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      }),
    };
  } catch (error) {
    logger.error('Failed to update user profile', { error });

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation error',
          details: error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to update user profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
