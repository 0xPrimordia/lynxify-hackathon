import { EventEmitter } from 'events';
/**
 * Event types for the unified agent architecture
 */
export var EventType;
(function (EventType) {
    // System events
    EventType["SYSTEM_INITIALIZED"] = "system:initialized";
    EventType["SYSTEM_ERROR"] = "system:error";
    EventType["SYSTEM_SHUTDOWN"] = "system:shutdown";
    // HCS message events
    EventType["MESSAGE_RECEIVED"] = "message:received";
    EventType["MESSAGE_SENT"] = "message:sent";
    EventType["MESSAGE_ERROR"] = "message:error";
    EventType["MESSAGE_RETRY"] = "message:retry";
    EventType["MESSAGE_TIMEOUT"] = "message:timeout";
    // HCS10 Protocol events
    EventType["HCS10_AGENT_REGISTERED"] = "hcs10:agent:registered";
    EventType["HCS10_AGENT_CONNECTED"] = "hcs10:agent:connected";
    EventType["HCS10_AGENT_DISCONNECTED"] = "hcs10:agent:disconnected";
    EventType["HCS10_REQUEST_SENT"] = "hcs10:request:sent";
    EventType["HCS10_REQUEST_RECEIVED"] = "hcs10:request:received";
    EventType["HCS10_RESPONSE_SENT"] = "hcs10:response:sent";
    EventType["HCS10_RESPONSE_RECEIVED"] = "hcs10:response:received";
    EventType["HCS10_REQUEST_TIMEOUT"] = "hcs10:request:timeout";
    EventType["HCS10_REQUEST_ERROR"] = "hcs10:request:error";
    // Tokenized Index events
    EventType["INDEX_REBALANCE_PROPOSED"] = "index:rebalance:proposed";
    EventType["INDEX_REBALANCE_APPROVED"] = "index:rebalance:approved";
    EventType["INDEX_REBALANCE_EXECUTED"] = "index:rebalance:executed";
    EventType["INDEX_PRICE_UPDATED"] = "index:price:updated";
    EventType["INDEX_RISK_ALERT"] = "index:risk:alert";
    EventType["INDEX_POLICY_CHANGED"] = "index:policy:changed";
    // Governance events
    EventType["INDEX_PROPOSAL_CREATED"] = "index:proposal:created";
    EventType["INDEX_PROPOSAL_VOTED"] = "index:proposal:voted";
    EventType["INDEX_PROPOSAL_EXECUTED"] = "index:proposal:executed";
    EventType["INDEX_TOKEN_ADDED"] = "index:token:added";
    EventType["INDEX_TOKEN_REMOVED"] = "index:token:removed";
    // Token operation events
    EventType["TOKEN_OPERATION_EXECUTED"] = "token:operation:executed";
    // Hedera service events
    EventType["HEDERA_TOPIC_CREATED"] = "hedera:topic:created";
    EventType["HEDERA_TOPIC_SUBSCRIBED"] = "hedera:topic:subscribed";
    EventType["HEDERA_TOPIC_UNSUBSCRIBED"] = "hedera:topic:unsubscribed";
    EventType["HEDERA_TRANSACTION_SUBMITTED"] = "hedera:transaction:submitted";
    EventType["HEDERA_TRANSACTION_CONFIRMED"] = "hedera:transaction:confirmed";
    EventType["HEDERA_TRANSACTION_FAILED"] = "hedera:transaction:failed";
})(EventType || (EventType = {}));
/**
 * Shared EventBus for cross-component communication
 *
 * This is a singleton that can be imported and used across all components
 * to facilitate communication between the different parts of the unified
 * agent architecture.
 */
export class EventBus extends EventEmitter {
    constructor() {
        super();
        // Set higher max listeners limit as we'll have multiple components
        this.setMaxListeners(50);
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    /**
     * Emit a typed event with payload
     */
    emitEvent(event, payload) {
        // Get all listeners for this event
        const listeners = this.listeners(event);
        // Call each listener with the payload, catching errors to prevent one bad handler
        // from stopping other handlers from being called
        listeners.forEach(listener => {
            try {
                listener(payload);
            }
            catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
        return true;
    }
    /**
     * Listen for a typed event
     */
    onEvent(event, listener) {
        return this.on(event, listener);
    }
    /**
     * Listen for a typed event once
     */
    onceEvent(event, listener) {
        // Use a wrapper function for proper removal
        const wrappedListener = (payload) => {
            // Remove the listener before calling it to ensure it's only called once
            this.removeListener(event, wrappedListener);
            try {
                listener(payload);
            }
            catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        };
        return this.on(event, wrappedListener);
    }
    /**
     * Remove a typed event listener
     */
    offEvent(event, listener) {
        return this.off(event, listener);
    }
    /**
     * Log all events (useful for debugging)
     */
    enableLogging() {
        Object.values(EventType).forEach(eventType => {
            this.on(eventType, (payload) => {
                console.log(`📣 Event: ${eventType}`, payload);
            });
        });
        console.log('🔍 Event logging enabled');
    }
}
// Export a singleton instance
export const eventBus = EventBus.getInstance();
