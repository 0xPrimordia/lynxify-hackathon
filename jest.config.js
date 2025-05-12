/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    '<rootDir>/src/app/**/*.{ts,tsx}',
    '!<rootDir>/src/app/**/*.d.ts'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/jest.setup.ts'
  ],
  verbose: true,
  testTimeout: 60000,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/e2e/',
    '/src/__tests__/integration/'
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  }
};

module.exports = config; 