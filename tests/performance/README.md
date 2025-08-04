# Performance Tests

This directory contains performance and load tests.

## Structure

- `lambda/` - Lambda function performance tests
- `database/` - Database performance tests

## Phase 7+ Guidelines

- Test response times and throughput  
- Measure cold start times
- Test concurrent request handling
- Set performance benchmarks

## Benchmarks

- Lambda cold start: < 1000ms
- Lambda warm response: < 200ms  
- Database queries: < 100ms
- Concurrent requests: Handle 10+ simultaneously