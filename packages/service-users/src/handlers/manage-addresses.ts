import { createLogger } from '@shared/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  addAddressRequestSchema,
  addressIdPathSchema,
  updateAddressRequestSchema,
} from '../schemas';
import { createUserProfileService } from '../services';

const logger = createLogger('manage-addresses');

/**
 * Add address handler - adds new address to user's profile
 */
export const addAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT
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

    const requestData = JSON.parse(event.body);
    const validatedData = addAddressRequestSchema.parse(requestData);

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
 * Update address handler - updates existing address
 */
export const updateAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT
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

    // Validate path parameters
    const pathParams = addressIdPathSchema.parse(event.pathParameters);
    const addressId = pathParams.addressId;

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const requestData = JSON.parse(event.body);
    const validatedData = updateAddressRequestSchema.parse(requestData);

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
 * Delete address handler - removes address from user's profile
 */
export const deleteAddressHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user from JWT
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
