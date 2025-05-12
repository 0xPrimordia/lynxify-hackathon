/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    "\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json'
    }]
  },
  testMatch: [
    '<rootDir>/src/__tests__/e2e/**/*.test.tsx',
    '<rootDir>/src/__tests__/integration/**/*.test.tsx',
    '<rootDir>/src/__tests__/connection-flow.test.ts',
    '<rootDir>/src/__tests__/profile-update.test.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/app/components/**/*.{ts,tsx}',
    '!<rootDir>/src/app/**/*.d.ts'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/jest.setup.ts'
  ],
  verbose: true,
  testTimeout: 60000,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  }
};

module.exports = config; 