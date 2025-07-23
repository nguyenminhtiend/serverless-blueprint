import { createLogger } from '@shared/core';
import { extractUserOrError, parseValidatedBody, UserContext } from '@shared/middleware';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  AddAddressRequest,
  addAddressRequestSchema,
  addressIdPathSchema,
  UpdateAddressRequest,
  updateAddressRequestSchema,
} from '../schemas';
import { createUserProfileService } from '../services';

const logger = createLogger('manage-addresses');

/**
 * Add Address Handler - Adds new address to user's profile
 */
export const addAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context or return error
    const userResult = extractUserOrError(event);
    if ('statusCode' in userResult) {
      return userResult; // Return error response
    }
    const { userId: cognitoSub } = userResult as UserContext;

    // Body is already parsed by middleware, just validate
    const validatedData = parseValidatedBody<AddAddressRequest>(event, addAddressRequestSchema);

    logger.info('Adding address for user', { cognitoSub });

    // Get user profile service
    const userProfileService = createUserProfileService();

    // Add address
    await userProfileService.addAddress(
      cognitoSub,
      validatedData.address,
      validatedData.label,
      validatedData.isDefault
    );

    logger.info('Address added successfully', { cognitoSub });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Address added successfully',
      }),
    };
  } catch (error) {
    logger.error('Failed to add address', { error });

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
        error: 'Failed to add address',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Update Address Handler - Updates existing address
 */
export const updateAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context or return error
    const userResult = extractUserOrError(event);
    if ('statusCode' in userResult) {
      return userResult; // Return error response
    }
    const { userId: cognitoSub } = userResult as UserContext;

    // Validate path parameters
    const pathParams = addressIdPathSchema.parse(event.pathParameters);
    const addressId = pathParams.addressId;

    // Body is already parsed by middleware, just validate
    const validatedData = parseValidatedBody<UpdateAddressRequest>(
      event,
      updateAddressRequestSchema
    );

    logger.info('Updating address for user', { cognitoSub, addressId });

    // Get user profile service
    const userProfileService = createUserProfileService();

    // Update address
    await userProfileService.updateAddress(cognitoSub, addressId, validatedData);

    logger.info('Address updated successfully', { cognitoSub, addressId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Address updated successfully',
      }),
    };
  } catch (error) {
    logger.error('Failed to update address', { error });

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
        error: 'Failed to update address',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Delete Address Handler - Removes address from user's profile
 */
export const deleteAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context or return error
    const userResult = extractUserOrError(event);
    if ('statusCode' in userResult) {
      return userResult; // Return error response
    }
    const { userId: cognitoSub } = userResult as UserContext;

    // Validate path parameters
    const pathParams = addressIdPathSchema.parse(event.pathParameters);
    const addressId = pathParams.addressId;

    logger.info('Removing address for user', { cognitoSub, addressId });

    // Get user profile service
    const userProfileService = createUserProfileService();

    // Remove address
    await userProfileService.removeAddress(cognitoSub, addressId);

    logger.info('Address removed successfully', { cognitoSub, addressId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Address removed successfully',
      }),
    };
  } catch (error) {
    logger.error('Failed to remove address', { error });

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
        error: 'Failed to remove address',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
