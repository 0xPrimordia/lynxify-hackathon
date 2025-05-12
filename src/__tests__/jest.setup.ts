import '@testing-library/jest-dom';

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

// For testing, we'll check for NODE_ENV=test in our services
// We can't directly assign to NODE_ENV as it's read-only
beforeAll(() => {
  // Use Object.defineProperty to set NODE_ENV (workaround for read-only property)
  Object.defineProperty(process.env, 'NODE_ENV', { 
    value: 'test',
    configurable: true
  });
});

afterAll(() => {
  // Restore original NODE_ENV
  Object.defineProperty(process.env, 'NODE_ENV', { 
    value: originalNodeEnv,
    configurable: true
  });
});

// Extend Jest's expect with TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }
}

// Add proper Jest type expectations to fix TypeScript errors
declare global {
  namespace jest {
    interface Expect {
      objectContaining<T>(obj: Partial<T>): T;
      stringContaining(str: string): string;
      stringMatching(str: string): string;
    }
  }
}

// Add proper Jest type declarations for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toHaveBeenCalledTimes(count: number): R;
      toBe(expected: any): R;
      toEqual(expected: any): R;
      not: Matchers<R>;
    }
  }
}

// Mock all timers by default for tests to prevent real timers from running
beforeEach(() => {
  jest.useFakeTimers();
});

// Clean up timers after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Silence console to prevent "Cannot log after tests are done" errors
// Comment these out during debugging if needed
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Replace console methods with silent mocks
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;

  // Try to force cleanup any remaining timers
  tryCleanupAllTimers();
});

/**
 * Helper function to try cleaning up any dangling timers
 * This helps prevent "Cannot log after tests are done" errors
 */
function tryCleanupAllTimers() {
  // Clear all timeouts and intervals we can find
  // Hack: Use a large number to try to clear all possible timer IDs
  const maxTimerId = 100000;
  for (let i = 0; i <= maxTimerId; i++) {
    try {
      clearTimeout(i);
      clearInterval(i);
    } catch (e) {
      // Ignore errors - not all IDs are valid timers
    }
  }
} 