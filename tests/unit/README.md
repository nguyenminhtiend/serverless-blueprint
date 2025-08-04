# Unit Tests

This directory contains unit tests for individual components and functions.

## Structure

- `shared/` - Tests for shared utilities and core functions
- `services/` - Tests for service-specific business logic  
- `middleware/` - Tests for middleware functions
- `database/` - Tests for database layer and repositories

## Phase 1-2 Guidelines

- Focus on testing individual functions in isolation
- Use simple mocks and stubs
- Test business logic without external dependencies
- Aim for fast execution (< 100ms per test)

## Examples

See `../example.test.ts` for basic test structure and patterns.