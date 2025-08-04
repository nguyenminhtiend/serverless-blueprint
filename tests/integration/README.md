# Integration Tests

This directory contains integration tests for testing component interactions.

## Structure

- `api/` - API endpoint integration tests
- `database/` - Database integration tests  
- `aws/` - AWS service integration tests

## Phase 5+ Guidelines

- Test component interactions
- Use LocalStack for AWS services
- Test real database operations
- Longer execution times acceptable (< 30s per test)

## Setup Required

- LocalStack container
- Test database setup
- AWS credentials (test)