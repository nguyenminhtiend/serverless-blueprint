import { beforeEach, afterEach, vi } from 'vitest'

// Basic test environment setup for unit tests only
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Clean up after each test
  vi.resetModules()
})