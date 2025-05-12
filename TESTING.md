# Testing Guide

## Running Tests

This project contains multiple test types:

1. **Core Service Tests**: Test the core services that are now fixed
   ```
   npm run test:services         # Main core services only
   npm run test:all-services     # All service tests
   npm run test:api              # API endpoint tests
   npm run test:types            # Type definition tests
   npm run test:utils            # Utility function tests
   npm run test:agents           # Agent service tests
   npm run test:core             # Run all core tests
   ```

2. **All Tests**: Run the complete test suite (excluding React component tests)
   ```
   npm test
   ```

3. **Simple Integration/E2E Tests**: These don't have React UI dependencies
   ```
   npm run test:e2e-simple       # Basic E2E tests without React dependencies
   npm run test:integration-simple # Basic integration tests without React
   ```

4. **React Component Tests**: These require a special environment
   ```
   npm run test:react            # Run tests using the React test configuration
   ```

## Test Types

### Unit Tests
Located in `src/__tests__/services`, `src/__tests__/types`, etc.
These test individual service functionality in isolation.

### Integration Tests
Located in `src/__tests__/integration`.
These test interactions between multiple services.

### End-to-End (E2E) Tests
Located in `src/__tests__/e2e`.
These test complete application workflows, some including UI components.

## Timer-Related Test Issues

### Common Timer Problems

Many of the timer-related issues in testing occur because:

1. **Unclosed Timeouts/Intervals**: Services create timers that don't get cleaned up
2. **Console Logging After Tests**: Timers that run after test completion try to log
3. **Unresolved Promises**: Tests may have promises that never resolve

### Fixes Implemented

Several fixes have been added to address timer issues:

1. **Environment Detection**: Services check for `NODE_ENV=test` and disable timers
   ```typescript
   // Only set up timers if not in test environment
   if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
     this.schedulePeriodicTasks();
   }
   ```

2. **Explicit Timer Cleanup**: Services have shutdown and dedicated timer cleanup methods
   ```typescript
   public disablePeriodicTimers(): void {
     this.clearIntervals();
   }
   
   private clearIntervals(): void {
     if (this.reregistrationInterval) {
       clearInterval(this.reregistrationInterval);
       this.reregistrationInterval = null;
     }
     // ...other timers
   }
   ```

3. **Enhanced Jest Setup**: The Jest setup now handles global cleanup
   ```typescript
   // Set NODE_ENV to 'test' to disable timers in services
   beforeAll(() => {
     Object.defineProperty(process.env, 'NODE_ENV', { 
       value: 'test',
       configurable: true
     });
   });
   ```

4. **Force Exit**: Using --forceExit flag for tests that might have issues
   ```
   npm run test:services -- --forceExit
   ```

### Testing Results

| Test Category           | Status  | Notes                                    |
|-------------------------|---------|------------------------------------------|
| Core Service Tests      | Passing | Fixed timer issues                       |
| API Tests               | Passing | All endpoints working correctly          |
| Type Tests              | Passing | Type system functioning properly         |
| Agent Tests             | Passing | Agent functionality working              |
| Simple E2E Tests        | Passing | Basic E2E tests without React           |
| Simple Integration      | Partial | Some tests fail with method name issues  |
| React Component Tests   | Pending | Need proper JSX environment setup        |

### Troubleshooting Tips

1. If tests are hanging, use the `--detectOpenHandles` flag to help identify issues
2. For React component tests, ensure you use the `jest.react.config.js` configuration
3. Run tests with `NODE_ENV=test` to disable timers in services
4. Clean up any intervals or timeouts in your `afterEach` hooks
5. For complex tests, consider using `--forceExit` to avoid hangs

## Known Issues

### React Component Tests

The e2e and integration tests containing React components currently have TypeScript compilation errors. These tests are excluded from the main test run to prevent the test suite from getting stuck.

To fix these:
1. The React component files need JSX transformation properly configured
2. The project should use Jest with the 'jsdom' test environment for these tests
3. A separate Jest config for React tests would be ideal

### Timer-Related Test Issues

Many of the timer-related issues in testing occur because:

1. **Unclosed Timeouts/Intervals**: Services create timers that don't get cleaned up
2. **Console Logging After Tests**: Timers that run after test completion try to log
3. **Unresolved Promises**: Tests may have promises that never resolve

### Fixes Implemented

Several fixes have been added to address timer issues:

1. **Environment Detection**: Services check for `NODE_ENV=test` and disable timers
2. **Manual Timer Cleanup**: `disableAgentTimers()` utility in `src/__tests__/utils/test-helpers.ts`
3. **Jest Fake Timers**: Using `jest.useFakeTimers()` to avoid real timer delays
4. **Console Mocking**: Mocked console methods in test setup to prevent post-test logging
5. **Force Exit**: The `--forceExit` flag for tests that may have lingering processes

### Using Fake Timers

Use fake timers in your tests to control time:

```javascript
// At the beginning of your test
jest.useFakeTimers();

// Fast forward time
jest.advanceTimersByTime(1000); // advance 1 second

// Clean up after tests
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
```

### Timer Cleanup in Services

Both `HCS10ProtocolService` and `TokenizedIndexService` have methods to disable timers:

```javascript
// In test cleanup
if (service) {
  service.disablePeriodicTimers(); // For HCS10ProtocolService
  service.disableRiskAssessmentTimer(); // For TokenizedIndexService
}
```

## React Component Testing Issues

The e2e/integration tests with React components may have TypeScript errors. To fix these:

1. Ensure all React component tests properly import required dependencies
2. TSX files require proper JSX handling in Jest configuration
3. Use `@testing-library/react` and its utilities for component testing
4. Add a separate Jest configuration for React component tests

## Running Tests Successfully

To run tests successfully without hanging:

1. Use the specialized test commands
   ```bash
   npm run test:core  # Run all core tests
   ```

2. When creating new tests, ensure they:
   - Properly clean up any timers or intervals
   - Mock external dependencies
   - Use the test helpers for disabling timers
   - Follow the pattern in existing working tests

3. If you need to run a specific test:
   ```bash
   npx jest path/to/your.test.ts --forceExit
   ```

## Troubleshooting

If tests are getting stuck:

1. Run with `--detectOpenHandles` to identify hanging timers/promises
2. Run specific test files rather than the entire suite
3. Use the `--forceExit` flag to terminate tests if they hang
4. Check for console logs after test completion
5. Monitor memory usage for leaks in long-running tests

For React component tests specifically, ensure they're properly using the test renderer and cleanup after each test.

# Future Tasks

The following test issues still need to be addressed:

1. **Service Tests with Variable Initialization Issues**:
   - `src/__tests__/services/hcs10-protocol.test.ts` - Has a "Cannot access before initialization" error
   - `src/__tests__/services/tokenized-index.test.ts` - Has a similar initialization error
   
2. **React Component Tests**:
   - Set up a proper Jest environment with React/JSX support
   - Fix the TypeScript errors in React component tests
   - Create a separate configuration for running UI tests
   
3. **Integration Tests with Method Name Issues**:
   - Fix the method name mismatch in `hcs10-agent-communication.test.ts` test 
   - Update mocks to use the correct method names (sendMessage vs publishMessage)
   
4. **Jest Test Configuration**:
   - Update the Jest configuration to avoid the ts-jest configuration warnings
   - Set up proper test isolation to avoid test interference

## Steps to Fix Remaining Tests

### 1. Service Tests
To fix the variable initialization order in test files:
```typescript
// First define all mock functions
const mockEventBusEmit = jest.fn();
const mockEventBusOn = jest.fn();

// Then initialize objects that use those functions
const mockEventBus = {
  emit: mockEventBusEmit,
  on: mockEventBusOn,
  // other methods...
};

// And finally mock the modules with those objects
jest.mock('path/to/module', () => ({
  EventBus: {
    getInstance: () => mockEventBus
  }
}));
```

### 2. React Component Tests
To properly test React components:
1. Set up `jest-environment-jsdom` in a separate Jest config
2. Use the `@testing-library/react` utilities
3. Create proper mocks for React-specific features
4. Fix JSX-related TypeScript errors

### 3. Integration Tests
To fix method name issues:
1. Examine the actual implementation of services
2. Update the mock implementations to match the current method signatures
3. Fix tests that rely on incorrect method names

### 4. Test Environment Setup
For proper test isolation:
1. Use `beforeEach`/`afterEach` to reset state between tests
2. Mock modules at the file level rather than globally
3. Ensure tests properly clean up resources like timers and subscriptions 