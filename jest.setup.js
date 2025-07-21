// Global test setup
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.TABLE_NAME = 'test-table';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-eventbridge');
jest.mock('@aws-sdk/client-sqs');

// Increase timeout for integration tests
jest.setTimeout(30000);
