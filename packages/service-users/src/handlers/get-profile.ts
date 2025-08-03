import { LambdaContext, ok, internalError, requireUserId } from '@shared/middleware';
import { getUserProfileResponseSchema } from '../schemas';
import { createCognitoService, createUserProfileService } from '../services';

/**
 * Get User Profile Handler - Retrieves user profile from both Cognito and DynamoDB
 */
export const getUserProfileHandler = async (ctx: LambdaContext) => {
  try {
    // Extract user from JWT claims (HTTP API v2.0 JWT authorizer)
    const cognitoSub = requireUserId(ctx.event);

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

    return ok({
      success: true,
      data: validatedProfile,
    });
  } catch (error) {
    internalError(error instanceof Error ? error.message : 'Unknown error during profile retrieval');
  }
};
