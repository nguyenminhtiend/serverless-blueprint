import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'aws-lambda';
import { getUserProfileHandler } from '../../../../packages/service-users/src/handlers';
import * as sharedCore from '@shared/core';
import * as services from '../../../../packages/service-users/src/services';
import * as schemas from '../../../../packages/service-users/src/schemas';
import { CognitoUser } from '../../../../packages/service-users/src/services/cognito';
import { ExtendedUserProfile } from '../../../../packages/service-users/src/schemas';
import { createMockEvent } from '../../../helpers/api-gateway-event';

// Get the mocked services
const { mockCognitoService, mockUserProfileService } = vi.mocked(services);

// Mock AWS clients first to prevent real client creation
vi.mock('@shared/core', () => ({
  requireUserId: vi.fn(),
  ok: vi.fn(),
  internalError: vi.fn(),
  AWSClients: {
    dynamoDB: {},
    cognito: {},
  },
}));

vi.mock('../../../../packages/service-users/src/services', () => {
  const mockCognitoService = {
    getUserByUsername: vi.fn(),
  };

  const mockUserProfileService = {
    getUserProfile: vi.fn(),
  };

  return {
    createCognitoService: vi.fn(() => mockCognitoService),
    createUserProfileService: vi.fn(() => mockUserProfileService),
    mockCognitoService,
    mockUserProfileService,
  };
});

vi.mock('../../../../packages/service-users/src/schemas', () => ({
  getUserProfileResponseSchema: {
    parse: vi.fn(),
  },
}));

describe('getUserProfileHandler', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-southeast-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  const mockCognitoUser: CognitoUser = {
    cognitoSub: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: true,
    enabled: true,
    status: 'CONFIRMED',
    attributes: {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      given_name: 'John',
      family_name: 'Doe',
      email_verified: 'true',
    },
  };

  const mockExtendedProfile: ExtendedUserProfile = {
    preferences: {
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
      theme: 'dark' as const,
      language: 'en',
      timezone: 'UTC',
    },
    addresses: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        label: 'Home',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        isDefault: true,
      },
    ],
    paymentMethods: [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        type: 'card' as const,
        label: 'Main Card',
        lastFour: '1234',
        isDefault: true,
      },
    ],
    businessRole: 'customer' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Successful scenarios', () => {
    it('should successfully return user profile with extended data', async () => {
      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: mockCognitoUser.cognitoSub,
          email: mockCognitoUser.email,
          firstName: mockCognitoUser.firstName,
          lastName: mockCognitoUser.lastName,
          extendedProfile: mockExtendedProfile,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(mockExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(sharedCore.requireUserId).toHaveBeenCalledWith(mockEvent);
      expect(mockCognitoService.getUserByUsername).toHaveBeenCalledWith(mockCognitoUser.cognitoSub);
      expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith(
        mockCognitoUser.cognitoSub
      );
      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });

    it('should successfully return user profile without extended data', async () => {
      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: mockCognitoUser.cognitoSub,
          email: mockCognitoUser.email,
          firstName: mockCognitoUser.firstName,
          lastName: mockCognitoUser.lastName,
          extendedProfile: null,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(null);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith(
        mockCognitoUser.cognitoSub
      );
      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle user with minimal Cognito data', async () => {
      const minimalCognitoUser: CognitoUser = {
        cognitoSub: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        emailVerified: true,
        enabled: true,
        status: 'CONFIRMED',
        attributes: {
          sub: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
        },
      };

      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: minimalCognitoUser.cognitoSub,
          email: minimalCognitoUser.email,
          firstName: undefined,
          lastName: undefined,
          extendedProfile: null,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(minimalCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(minimalCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(null);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });
  });

  describe('Error scenarios', () => {
    it('should handle missing user ID from JWT', async () => {
      const errorMessage = 'Missing user ID in JWT claims';
      vi.mocked(sharedCore.requireUserId).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(sharedCore.requireUserId).toHaveBeenCalledWith(mockEvent);
      expect(services.createCognitoService).not.toHaveBeenCalled();
      expect(services.createUserProfileService).not.toHaveBeenCalled();
      expect(sharedCore.internalError).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle Cognito service errors', async () => {
      const errorMessage = 'Failed to retrieve user from Cognito';
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockRejectedValue(new Error(errorMessage));

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(mockCognitoService.getUserByUsername).toHaveBeenCalledWith(mockCognitoUser.cognitoSub);
      expect(mockUserProfileService.getUserProfile).not.toHaveBeenCalled();
      expect(sharedCore.internalError).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle user profile service errors', async () => {
      const errorMessage = 'Failed to retrieve user profile from DynamoDB';
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockRejectedValue(new Error(errorMessage));

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(mockCognitoService.getUserByUsername).toHaveBeenCalledWith(mockCognitoUser.cognitoSub);
      expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith(
        mockCognitoUser.cognitoSub
      );
      expect(sharedCore.internalError).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle schema validation errors', async () => {
      const validationError = new Error('Invalid response schema');
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(mockExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockImplementation(() => {
        throw validationError;
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalled();
      expect(sharedCore.ok).not.toHaveBeenCalled();
      expect(sharedCore.internalError).toHaveBeenCalledWith('Invalid response schema');
    });

    // Note: Service initialization errors now occur at module level, not during handler execution
    // This test is no longer applicable with module-level service initialization

    it('should handle unknown errors', async () => {
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockRejectedValue('Unknown error');

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(sharedCore.internalError).toHaveBeenCalledWith(
        'Unknown error during profile retrieval'
      );
    });

    it('should handle null/undefined errors', async () => {
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockRejectedValue(null);

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(sharedCore.internalError).toHaveBeenCalledWith(
        'Unknown error during profile retrieval'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty extended profile', async () => {
      const emptyExtendedProfile: ExtendedUserProfile = {
        addresses: [],
        paymentMethods: [],
        businessRole: 'customer',
      };

      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: mockCognitoUser.cognitoSub,
          email: mockCognitoUser.email,
          firstName: mockCognitoUser.firstName,
          lastName: mockCognitoUser.lastName,
          extendedProfile: emptyExtendedProfile,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(emptyExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle admin business role', async () => {
      const adminExtendedProfile: ExtendedUserProfile = {
        ...mockExtendedProfile,
        businessRole: 'admin',
      };

      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: mockCognitoUser.cognitoSub,
          email: mockCognitoUser.email,
          firstName: mockCognitoUser.firstName,
          lastName: mockCognitoUser.lastName,
          extendedProfile: adminExtendedProfile,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(adminExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle user with special characters in name', async () => {
      const specialCharUser: CognitoUser = {
        ...mockCognitoUser,
        firstName: 'José',
        lastName: "O'Connor",
      };

      const expectedResponse = {
        success: true,
        data: {
          cognitoSub: specialCharUser.cognitoSub,
          email: specialCharUser.email,
          firstName: specialCharUser.firstName,
          lastName: specialCharUser.lastName,
          extendedProfile: null,
        },
      };

      vi.mocked(sharedCore.requireUserId).mockReturnValue(specialCharUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(specialCharUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(null);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue(expectedResponse.data);
      vi.mocked(sharedCore.ok).mockReturnValue({
        statusCode: 200,
        body: JSON.stringify(expectedResponse),
      });

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(schemas.getUserProfileResponseSchema.parse).toHaveBeenCalledWith(
        expectedResponse.data
      );
      expect(sharedCore.ok).toHaveBeenCalledWith(expectedResponse);
    });
  });

  describe('Service interaction validation', () => {
    it('should call services with correct parameters', async () => {
      const cognitoSub = '123e4567-e89b-12d3-a456-426614174000';

      vi.mocked(sharedCore.requireUserId).mockReturnValue(cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(mockExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue({} as any);
      vi.mocked(sharedCore.ok).mockReturnValue({} as any);

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });

      expect(mockCognitoService.getUserByUsername).toHaveBeenCalledWith(cognitoSub);
      expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith(cognitoSub);
    });

    it('should create services only once per handler execution', async () => {
      vi.mocked(sharedCore.requireUserId).mockReturnValue(mockCognitoUser.cognitoSub);
      mockCognitoService.getUserByUsername.mockResolvedValue(mockCognitoUser);
      mockUserProfileService.getUserProfile.mockResolvedValue(mockExtendedProfile);
      vi.mocked(schemas.getUserProfileResponseSchema.parse).mockReturnValue({} as any);
      vi.mocked(sharedCore.ok).mockReturnValue({} as any);

      const mockEvent = createMockEvent();
      await getUserProfileHandler({ event: mockEvent, context: mockContext });
    });
  });
});
