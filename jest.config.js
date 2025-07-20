module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/src/**/*.test.ts',
    '!packages/**/src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/packages/shared-$1/src',
    '^@auth/(.*)$': '<rootDir>/packages/service-auth/src/$1',
    '^@users/(.*)$': '<rootDir>/packages/service-users/src/$1',
    '^@orders/(.*)$': '<rootDir>/packages/service-orders/src/$1',
    '^@notifications/(.*)$': '<rootDir>/packages/service-notifications/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};