import { beforeEach, afterEach, vi, beforeAll } from 'vitest'

// Global test environment setup
beforeAll(() => {
  // Disable request/response logging during all tests
  process.env.ENABLE_REQUEST_LOGGING = 'false'
})

// Basic test environment setup for unit tests only
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  // Suppress console.error during tests to reduce noise from expected errors
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // Clean up after each test
  vi.resetModules()
})

// Global mock setup for AWS SDK
vi.mock('@aws-sdk/client-cognito-identity-provider')
vi.mock('@aws-sdk/client-dynamodb')
vi.mock('@aws-sdk/lib-dynamodb')
vi.mock('@aws-sdk/client-eventbridge')
vi.mock('@aws-sdk/client-ses')
vi.mock('@aws-sdk/client-sns')