/**
 * Jest configuration for E2E tests that require browser APIs
 * This is needed because the @hashgraphonline/standards-sdk package 
 * uses browser-specific APIs like 'window'
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Use jsdom instead of node
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Only run tests in the e2e and integration directories
  testMatch: [
    '**/src/__tests__/e2e/**/*.test.ts',
    '**/src/__tests__/integration/agent-registration.test.ts'
  ]
}; 