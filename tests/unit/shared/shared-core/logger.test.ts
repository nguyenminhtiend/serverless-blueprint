import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLogger } from '@shared/core'

// Mock AWS Lambda Powertools Logger
vi.mock('@aws-lambda-powertools/logger', () => {
  const mockLogger = {
    config: {},
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }

  const MockLoggerClass = vi.fn().mockImplementation((config) => {
    mockLogger.config = config
    return mockLogger
  })

  return {
    Logger: MockLoggerClass
  }
})

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment variables
    delete process.env.ENVIRONMENT
    delete process.env.NODE_ENV
    delete process.env.VERSION
  })

  describe('createLogger', () => {
    it('should create logger with service name', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      
      createLogger('test-service')
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'INFO',
        persistentLogAttributes: {
          environment: 'dev',
          version: '1.0.0',
        }
      })
    })

    it('should create logger with custom context', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      const context = { requestId: '12345', userId: 'user-123' }
      
      createLogger('test-service', context)
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'INFO',
        persistentLogAttributes: {
          environment: 'dev',
          version: '1.0.0',
          requestId: '12345',
          userId: 'user-123',
        }
      })
    })

    it('should create logger with custom options', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      const options = {
        level: 'DEBUG',
        environment: 'production',
        version: '2.0.0'
      }
      
      createLogger('test-service', {}, options)
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'DEBUG',
        persistentLogAttributes: {
          environment: 'production',
          version: '2.0.0',
        }
      })
    })

    it('should use environment variables as defaults', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      process.env.ENVIRONMENT = 'staging'
      process.env.VERSION = '1.5.0'
      
      createLogger('test-service')
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'INFO',
        persistentLogAttributes: {
          environment: 'staging',
          version: '1.5.0',
        }
      })
    })

    it('should use NODE_ENV when ENVIRONMENT is not set', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      process.env.NODE_ENV = 'test'
      
      createLogger('test-service')
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'INFO',
        persistentLogAttributes: {
          environment: 'test',
          version: '1.0.0',
        }
      })
    })

    it('should merge context with environment options', async () => {
      const { Logger } = await vi.importMock('@aws-lambda-powertools/logger')
      const context = { customField: 'value' }
      const options = { environment: 'prod' }
      
      createLogger('test-service', context, options)
      
      expect(Logger).toHaveBeenCalledWith({
        serviceName: 'test-service',
        logLevel: 'INFO',
        persistentLogAttributes: {
          environment: 'prod',
          version: '1.0.0',
          customField: 'value',
        }
      })
    })

    it('should return logger instance', () => {
      const logger = createLogger('test-service')
      
      expect(logger).toBeDefined()
      expect(typeof logger).toBe('object')
    })
  })
})