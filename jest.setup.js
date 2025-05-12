// Jest setup file for controlling global behavior

// Mock all timers by default for tests to prevent real timers from running
beforeEach(() => {
  jest.useFakeTimers();
});

// Clean up timers after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Suppress specific console methods during tests to avoid log noise
// Uncomment as needed
/*
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
*/ 