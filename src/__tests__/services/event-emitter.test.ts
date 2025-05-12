import { EventBus, EventType, EventPayloads } from '../../../src/app/utils/event-emitter';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Get a fresh instance for each test
    // Clear the singleton for testing purposes
    // @ts-ignore - access private static field for testing
    EventBus['instance'] = undefined;
    eventBus = EventBus.getInstance();
  });

  test('should be a singleton', () => {
    const instance1 = EventBus.getInstance();
    const instance2 = EventBus.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should emit and receive system events', (done) => {
    // Set up listener
    eventBus.onEvent(EventType.SYSTEM_INITIALIZED, () => {
      done();
    });

    // Emit event
    eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
  });

  test('should emit and receive events with payloads', (done) => {
    const testPayload = {
      topicId: 'test-topic',
      contents: { test: 'data' },
      transactionId: 'test-tx-id'
    };

    // Set up listener
    eventBus.onEvent(EventType.MESSAGE_SENT, (payload) => {
      expect(payload).toEqual(testPayload);
      done();
    });

    // Emit event with payload
    eventBus.emitEvent(EventType.MESSAGE_SENT, testPayload);
  });

  test('should remove event listener correctly', () => {
    const mockCallback = jest.fn();
    
    // Add listener
    eventBus.onEvent(EventType.SYSTEM_ERROR, mockCallback);
    
    // Emit event
    const errorPayload = new Error('Test error');
    eventBus.emitEvent(EventType.SYSTEM_ERROR, errorPayload);
    
    // Verify callback was called
    expect(mockCallback).toHaveBeenCalledWith(errorPayload);
    
    // Reset mock
    mockCallback.mockReset();
    
    // Remove listener
    eventBus.offEvent(EventType.SYSTEM_ERROR, mockCallback);
    
    // Emit event again
    eventBus.emitEvent(EventType.SYSTEM_ERROR, new Error('Another error'));
    
    // Verify callback was not called
    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('onceEvent should only trigger once', () => {
    // Use a spy instead of a mock function to properly catch all calls
    const mockCallback = jest.fn();
    
    // Register onceEvent handler
    eventBus.onceEvent(EventType.SYSTEM_INITIALIZED, mockCallback);
    
    // Emit the event twice in sequence
    eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
    eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
    
    // Verify callback was only called once
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  test('should handle multiple listeners for the same event', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    // Add listeners
    eventBus.onEvent(EventType.HEDERA_TOPIC_CREATED, mockCallback1);
    eventBus.onEvent(EventType.HEDERA_TOPIC_CREATED, mockCallback2);
    
    // Emit event
    const payload = {
      topicId: 'test-topic',
      memo: 'Test memo'
    };
    
    eventBus.emitEvent(EventType.HEDERA_TOPIC_CREATED, payload);
    
    // Verify both callbacks were called
    expect(mockCallback1).toHaveBeenCalledWith(payload);
    expect(mockCallback2).toHaveBeenCalledWith(payload);
  });

  test('should handle errors in event listeners gracefully', () => {
    const mockCallback1 = jest.fn().mockImplementation(() => {
      throw new Error('Test error in listener');
    });
    const mockCallback2 = jest.fn();
    
    // Add listeners
    eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, mockCallback1);
    eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, mockCallback2);
    
    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Emit event - this should not throw
    const payload = {
      tokenId: 'test-token',
      price: 100,
      source: 'test-source'
    };
    
    // Modify test to check if the second callback was called, rather than
    // expecting the error to be caught during emission
    eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, payload);
    
    // Verify first callback was called
    expect(mockCallback1).toHaveBeenCalled();
    
    // Verify second callback was still called despite error in first
    expect(mockCallback2).toHaveBeenCalled();
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('enableLogging should add listeners for all event types', () => {
    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Enable logging
    eventBus.enableLogging();
    
    // Emit a few different events
    eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
    eventBus.emitEvent(EventType.MESSAGE_SENT, {
      topicId: 'test-topic',
      contents: { test: 'data' },
      transactionId: 'test-tx-id'
    });
    
    // Verify console.log was called for each event
    expect(consoleLogSpy).toHaveBeenCalledTimes(3); // 2 events + 1 for "logging enabled" message
    
    // Restore console.log
    consoleLogSpy.mockRestore();
  });
}); 