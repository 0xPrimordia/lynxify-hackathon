import { EventBus, EventType } from './event-emitter';
describe('EventBus', () => {
    // Reset the EventBus singleton before each test
    beforeEach(() => {
        // Access the private static instance using any to reset it
        EventBus.instance = undefined;
    });
    it('should be a singleton', () => {
        const instance1 = EventBus.getInstance();
        const instance2 = EventBus.getInstance();
        expect(instance1).toBe(instance2);
    });
    it('should emit and receive events', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback = jest.fn();
        // Register event listener
        eventBus.onEvent(EventType.SYSTEM_INITIALIZED, mockCallback);
        // Emit the event
        eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
        // Verify the callback was called
        expect(mockCallback).toHaveBeenCalledTimes(1);
    });
    it('should pass event payload to listeners', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback = jest.fn();
        const payload = {
            topicId: 'test-topic',
            sequenceNumber: 123,
            contents: { message: 'test message' },
            consensusTimestamp: '2023-07-15T12:00:00Z'
        };
        // Register event listener
        eventBus.onEvent(EventType.MESSAGE_RECEIVED, mockCallback);
        // Emit the event with payload
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, payload);
        // Verify the callback was called with the correct payload
        expect(mockCallback).toHaveBeenCalledWith(payload);
    });
    it('should remove event listeners', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback = jest.fn();
        // Register event listener
        eventBus.onEvent(EventType.SYSTEM_ERROR, mockCallback);
        // Emit the event
        eventBus.emitEvent(EventType.SYSTEM_ERROR, new Error('Test error'));
        // Verify the callback was called
        expect(mockCallback).toHaveBeenCalledTimes(1);
        mockCallback.mockClear();
        // Remove listener
        eventBus.offEvent(EventType.SYSTEM_ERROR, mockCallback);
        // Emit the event again
        eventBus.emitEvent(EventType.SYSTEM_ERROR, new Error('Another error'));
        // Verify the callback was not called
        expect(mockCallback).not.toHaveBeenCalled();
    });
    it('should only call onceEvent listeners once', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback = jest.fn();
        // Register once event listener
        eventBus.onceEvent(EventType.HCS10_AGENT_REGISTERED, mockCallback);
        // Emit the event twice
        const payload = {
            agentId: 'test-agent',
            registryTopicId: 'test-registry'
        };
        eventBus.emitEvent(EventType.HCS10_AGENT_REGISTERED, payload);
        eventBus.emitEvent(EventType.HCS10_AGENT_REGISTERED, payload);
        // Verify the callback was called only once
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(payload);
    });
    it('should handle multiple listeners for the same event', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback1 = jest.fn();
        const mockCallback2 = jest.fn();
        // Register multiple listeners
        eventBus.onEvent(EventType.HEDERA_TOPIC_CREATED, mockCallback1);
        eventBus.onEvent(EventType.HEDERA_TOPIC_CREATED, mockCallback2);
        // Emit the event
        const payload = {
            topicId: 'test-topic',
            memo: 'Test memo'
        };
        eventBus.emitEvent(EventType.HEDERA_TOPIC_CREATED, payload);
        // Verify both callbacks were called
        expect(mockCallback1).toHaveBeenCalledWith(payload);
        expect(mockCallback2).toHaveBeenCalledWith(payload);
    });
    it('should handle errors in event listeners gracefully', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback1 = jest.fn().mockImplementation(() => {
            throw new Error('Test error in listener');
        });
        const mockCallback2 = jest.fn();
        // Register listeners
        eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, mockCallback1);
        eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, mockCallback2);
        // Spy on console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        // Emit event
        const payload = {
            tokenId: 'test-token',
            price: 100,
            source: 'test-source'
        };
        // This should not throw
        expect(() => {
            eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, payload);
        }).not.toThrow();
        // Verify first callback was called and threw error
        expect(mockCallback1).toHaveBeenCalled();
        // Verify second callback was still called despite error in first
        expect(mockCallback2).toHaveBeenCalled();
        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
        // Restore console.error
        consoleErrorSpy.mockRestore();
    });
    it('should add log listeners for all events when enableLogging is called', () => {
        const eventBus = EventBus.getInstance();
        // Spy on console.log
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        // Enable logging
        eventBus.enableLogging();
        // Emit events
        eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
        eventBus.emitEvent(EventType.HCS10_AGENT_REGISTERED, {
            agentId: 'test-agent',
            registryTopicId: 'test-registry'
        });
        // Verify console.log was called for the log message and each event
        expect(consoleLogSpy).toHaveBeenCalledTimes(3);
        // Restore console.log
        consoleLogSpy.mockRestore();
    });
    it('should handle new TOKEN_OPERATION_EXECUTED event type', () => {
        const eventBus = EventBus.getInstance();
        const mockCallback = jest.fn();
        // Register event listener
        eventBus.onEvent(EventType.TOKEN_OPERATION_EXECUTED, mockCallback);
        // Emit the event with payload
        const payload = {
            operation: 'mint',
            token: 'LYNX',
            amount: 100,
            success: true,
            timestamp: Date.now()
        };
        eventBus.emitEvent(EventType.TOKEN_OPERATION_EXECUTED, payload);
        // Verify the callback was called with the correct payload
        expect(mockCallback).toHaveBeenCalledWith(payload);
    });
});
