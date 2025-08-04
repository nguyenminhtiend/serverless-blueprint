import { vi } from 'vitest';

// General test utility functions

/**
 * Wait for a specified amount of time
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Create a mock function with return value
 */
export const createMockFn = <T>(returnValue?: T) => {
  const fn = vi.fn();
  if (returnValue !== undefined) {
    fn.mockReturnValue(returnValue);
  }
  return fn;
};

/**
 * Generate a random string for testing
 */
export const randomString = (length = 8): string => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};

/**
 * Generate a random email for testing
 */
export const randomEmail = (): string => {
  return `test-${randomString()}@example.com`;
};
