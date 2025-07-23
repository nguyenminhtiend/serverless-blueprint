# User Service Testing Guide - Phase 8.1

## Overview

This guide provides comprehensive testing instructions for the User Service implementation in Phase 8.1. The User Service includes Cognito integration for user authentication and DynamoDB for extended user profile management.

## Prerequisites

1. **VS Code REST Client Extension**: Install `ms-vscode.vscode-restclient`
2. **Deployed Infrastructure**: Ensure all stacks are deployed successfully
3. **Test Account**: Create a test user account for authentication

## API Endpoints

- **Base URL**: `https://vvktlt1hti.execute-api.ap-southeast-1.amazonaws.com`
- **User Profile**: `GET/PUT /users/profile`
- **Address Management**: 
  - `POST /users/addresses` - Add new address
  - `PUT /users/addresses/{addressId}` - Update address
  - `DELETE /users/addresses/{addressId}` - Delete address

## Authentication Flow

### Step 1: User Registration and Authentication

1. **Register User** (Test #1)
   - Creates new user in Cognito User Pool
   - User receives confirmation email

2. **Confirm Signup** (Test #2)
   - Use confirmation code from email
   - Activates the user account

3. **Login** (Test #3)
   - Returns JWT tokens (idToken, accessToken, refreshToken)
   - Copy the `idToken` for subsequent requests

### Step 2: Update Token Variables

Update the variables in `test.http`:
```http
@id_token = YOUR_ACTUAL_ID_TOKEN_HERE
@access_token = YOUR_ACTUAL_ACCESS_TOKEN_HERE
```

## Core User Service Tests

### Profile Management Tests (Tests #9-11)

**Test #9: Get User Profile**
- **Purpose**: Retrieve combined user data from Cognito and DynamoDB
- **Expected Response**:
  ```json
  {
    "success": true,
    "data": {
      "cognitoSub": "uuid",
      "email": "test-user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "extendedProfile": null // Initially null for new users
    }
  }
  ```

**Test #10: Update User Profile - Basic Preferences**
- **Purpose**: Set user preferences and business role
- **Expected**: 200 OK with updated profile data

**Test #11: Update User Profile - Partial Preferences**
- **Purpose**: Test partial updates (only theme change)
- **Expected**: 200 OK with merged preferences

### Address Management Tests (Tests #12-15)

**Test #12: Add Primary Address**
- **Purpose**: Add user's main address with default flag
- **Expected**: 201 Created

**Test #13: Add Secondary Address**
- **Purpose**: Add additional address (non-default)
- **Expected**: 201 Created

**Test #14: Update Address**
- **Purpose**: Modify existing address
- **Note**: Replace `00000000-0000-0000-0000-000000000000` with actual address ID
- **Expected**: 200 OK

**Test #15: Delete Address**
- **Purpose**: Remove address from user profile
- **Expected**: 200 OK

## Error Handling Tests (Tests #16-22)

### Authentication Errors
- **Test #16**: No Authorization header → 401 Unauthorized
- **Test #17**: Invalid JWT token → 401 Unauthorized

### Validation Errors
- **Test #18**: Invalid JSON schema → 400 Bad Request
- **Test #19**: Missing required fields → 400 Bad Request
- **Test #20**: Invalid data types → 400 Bad Request

### Resource Errors
- **Test #21**: Update non-existent address → 500 Internal Server Error
- **Test #22**: Delete non-existent address → 500 Internal Server Error

## Method Not Allowed Tests (Tests #23-25)

These tests verify proper HTTP method routing:
- **Test #23**: POST to profile endpoint → 405 Method Not Allowed
- **Test #24**: GET to addresses collection → 405 Method Not Allowed
- **Test #25**: POST to specific address → 405 Method Not Allowed

## Path Validation Tests (Tests #26-27)

- **Test #26**: Invalid user service path → 404 Not Found
- **Test #27**: Invalid UUID format → 404 Not Found

## Data Validation Edge Cases (Tests #28-30)

### Maximum Length Testing (Test #28)
Tests field length limits:
- Street: 200 characters
- City: 100 characters
- State: 100 characters
- Country: 100 characters
- Label: 50 characters

### Minimum Length Testing (Test #29)
Tests minimum acceptable field lengths

### Complete Preferences Testing (Test #30)
Tests all preference options and business role changes

## Integration Testing Scenarios (Tests #31-35)

### Complete Workflow Test
1. **Test #31**: Get initial profile (minimal data)
2. **Test #32**: Set up complete preferences
3. **Test #33**: Add home address
4. **Test #34**: Add work address
5. **Test #35**: Verify final complete profile

## Performance Tests (Tests #36-37)

- **Test #36**: Rapid profile updates
- **Test #37**: Rapid address additions

## Expected Data Structures

### User Profile Response
```json
{
  "success": true,
  "data": {
    "cognitoSub": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "extendedProfile": {
      "preferences": {
        "theme": "dark",
        "language": "en",
        "timezone": "UTC",
        "notifications": {
          "email": true,
          "sms": false,
          "push": true
        }
      },
      "addresses": [
        {
          "id": "uuid",
          "street": "123 Main St",
          "city": "New York",
          "state": "NY",
          "zipCode": "10001",
          "country": "USA",
          "label": "Home",
          "isDefault": true
        }
      ],
      "paymentMethods": [],
      "businessRole": "customer"
    }
  }
}
```

### Error Response Format
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional validation details (for Zod errors)"
}
```

## Testing Best Practices

### 1. Sequential Testing
Run tests in order, especially for workflow scenarios (Tests #31-35)

### 2. Token Management
- Tokens expire after 1 hour by default
- Re-authenticate if tests start failing with 401 errors

### 3. Address ID Management
- Save address IDs from POST responses
- Use real IDs in UPDATE/DELETE tests
- UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 4. Data Cleanup
- Delete test addresses after testing
- User profile data persists in DynamoDB

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check JWT token validity
   - Ensure Bearer token format
   - Verify user is confirmed in Cognito

2. **500 Internal Server Error**
   - Check CloudWatch logs for Lambda function
   - Verify DynamoDB table permissions
   - Check Cognito User Pool configuration

3. **400 Bad Request**
   - Validate JSON syntax
   - Check required fields
   - Verify data types match schema

### Monitoring

Check AWS CloudWatch logs:
- `/aws/lambda/dev-user-service` - User Service logs
- `/aws/apigateway/dev-microservices-api` - API Gateway logs

### Performance Benchmarks

Expected response times:
- Profile operations: < 1000ms
- Address operations: < 800ms
- Authentication: < 2000ms

## Security Validation

1. **JWT Token Validation**: All protected endpoints require valid JWT
2. **User Isolation**: Users can only access their own data
3. **Input Sanitization**: All inputs validated with Zod schemas
4. **Error Information**: Sensitive data not exposed in error responses

## Next Steps

After successful User Service testing:
1. Proceed to Phase 8.2 - Orders Service implementation
2. Test cross-service integration scenarios
3. Performance optimization based on test results