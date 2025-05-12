import { EventEmitter } from 'events';

/**
 * Event types for the unified agent architecture
 */
export enum EventType {
  // System events
  SYSTEM_INITIALIZED = 'system:initialized',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  
  // HCS message events
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_SENT = 'message:sent',
  MESSAGE_ERROR = 'message:error',
  MESSAGE_RETRY = 'message:retry',
  MESSAGE_TIMEOUT = 'message:timeout',
  
  // HCS10 Protocol events
  HCS10_AGENT_REGISTERED = 'hcs10:agent:registered',
  HCS10_AGENT_CONNECTED = 'hcs10:agent:connected',
  HCS10_AGENT_DISCONNECTED = 'hcs10:agent:disconnected',
  HCS10_REQUEST_SENT = 'hcs10:request:sent',
  HCS10_REQUEST_RECEIVED = 'hcs10:request:received',
  HCS10_RESPONSE_SENT = 'hcs10:response:sent',
  HCS10_RESPONSE_RECEIVED = 'hcs10:response:received',
  HCS10_REQUEST_TIMEOUT = 'hcs10:request:timeout',
  HCS10_REQUEST_ERROR = 'hcs10:request:error',
  
  // Tokenized Index events
  INDEX_REBALANCE_PROPOSED = 'index:rebalance:proposed',
  INDEX_REBALANCE_APPROVED = 'index:rebalance:approved',
  INDEX_REBALANCE_EXECUTED = 'index:rebalance:executed',
  INDEX_PRICE_UPDATED = 'index:price:updated',
  INDEX_RISK_ALERT = 'index:risk:alert',
  INDEX_POLICY_CHANGED = 'index:policy:changed',
  
  // Governance events
  INDEX_PROPOSAL_CREATED = 'index:proposal:created',
  INDEX_PROPOSAL_VOTED = 'index:proposal:voted',
  INDEX_PROPOSAL_EXECUTED = 'index:proposal:executed',
  INDEX_TOKEN_ADDED = 'index:token:added',
  INDEX_TOKEN_REMOVED = 'index:token:removed',
  
  // Token operation events
  TOKEN_OPERATION_EXECUTED = 'token:operation:executed',
  
  // Hedera service events
  HEDERA_TOPIC_CREATED = 'hedera:topic:created',
  HEDERA_TOPIC_SUBSCRIBED = 'hedera:topic:subscribed',
  HEDERA_TOPIC_UNSUBSCRIBED = 'hedera:topic:unsubscribed',
  HEDERA_TRANSACTION_SUBMITTED = 'hedera:transaction:submitted',
  HEDERA_TRANSACTION_CONFIRMED = 'hedera:transaction:confirmed',
  HEDERA_TRANSACTION_FAILED = 'hedera:transaction:failed'
}

/**
 * Event payload types for the unified agent architecture
 */
export interface EventPayloads {
  // System events
  [EventType.SYSTEM_INITIALIZED]: {
    agentId: string;
    timestamp: number;
    status: string;
  };
  [EventType.SYSTEM_ERROR]: Error;
  [EventType.SYSTEM_SHUTDOWN]: undefined;
  
  // HCS message events
  [EventType.MESSAGE_RECEIVED]: {
    topicId: string;
    sequenceNumber: number;
    contents: any;
    consensusTimestamp: string;
  };
  [EventType.MESSAGE_SENT]: {
    topicId: string;
    contents: any;
    transactionId: string;
  };
  [EventType.MESSAGE_ERROR]: {
    topicId: string;
    error: Error;
    contents?: any;
  };
  [EventType.MESSAGE_RETRY]: {
    messageId: string;
    retryCount: number;
    recipientId: string;
  };
  [EventType.MESSAGE_TIMEOUT]: {
    messageId: string;
    recipientId: string;
    elapsedTimeMs: number;
  };
  
  // HCS10 Protocol events
  [EventType.HCS10_AGENT_REGISTERED]: {
    agentId: string;
    registryTopicId: string;
  };
  [EventType.HCS10_AGENT_CONNECTED]: {
    agentId: string;
    capabilities: string[];
  };
  [EventType.HCS10_AGENT_DISCONNECTED]: {
    agentId: string;
    reason?: string;
  };
  [EventType.HCS10_REQUEST_SENT]: {
    requestId: string;
    recipientId: string;
    request: any;
  };
  [EventType.HCS10_REQUEST_RECEIVED]: {
    requestId: string;
    senderId: string;
    request: any;
  };
  [EventType.HCS10_RESPONSE_SENT]: {
    requestId: string;
    recipientId: string;
    response: any;
  };
  [EventType.HCS10_RESPONSE_RECEIVED]: {
    requestId: string;
    senderId: string;
    response: any;
  };
  [EventType.HCS10_REQUEST_TIMEOUT]: {
    requestId: string;
    recipientId: string;
    timeoutMs: number;
  };
  [EventType.HCS10_REQUEST_ERROR]: {
    requestId: string;
    recipientId: string;
    error: Error;
  };
  
  // Tokenized Index events
  [EventType.INDEX_REBALANCE_PROPOSED]: {
    proposalId: string;
    newWeights: Record<string, number>;
    trigger: 'price_deviation' | 'risk_threshold' | 'scheduled';
  };
  [EventType.INDEX_REBALANCE_APPROVED]: {
    proposalId: string;
    approvedAt: number;
  };
  [EventType.INDEX_REBALANCE_EXECUTED]: {
    proposalId: string;
    preBalances: Record<string, number>;
    postBalances: Record<string, number>;
    executedAt: number;
  };
  [EventType.INDEX_PRICE_UPDATED]: {
    tokenId: string;
    price: number;
    source: string;
  };
  [EventType.INDEX_RISK_ALERT]: {
    severity: 'low' | 'medium' | 'high';
    riskDescription: string;
    affectedTokens?: string[];
  };
  [EventType.INDEX_POLICY_CHANGED]: {
    policyId: string;
    changes: Record<string, any>;
    effectiveFrom: number;
  };
  
  // Governance events
  [EventType.INDEX_PROPOSAL_CREATED]: {
    proposalId: string;
    type: string;
    creator: string;
  };
  [EventType.INDEX_PROPOSAL_VOTED]: {
    proposalId: string;
    voter: string;
    voteType: string;
    weight: number;
  };
  [EventType.INDEX_PROPOSAL_EXECUTED]: {
    proposalId: string;
    executedAt: number;
    success: boolean;
  };
  [EventType.INDEX_TOKEN_ADDED]: {
    tokenId: string;
    tokenSymbol: string;
    initialWeight: number;
    addedAt: number;
  };
  [EventType.INDEX_TOKEN_REMOVED]: {
    tokenId: string;
    removedAt: number;
  };
  
  // Token operation events
  [EventType.TOKEN_OPERATION_EXECUTED]: {
    operation: 'mint' | 'burn';
    token: string;
    amount: number;
    success: boolean;
    timestamp: number;
  };
  
  // Hedera service events
  [EventType.HEDERA_TOPIC_CREATED]: {
    topicId: string;
    memo?: string;
  };
  [EventType.HEDERA_TOPIC_SUBSCRIBED]: {
    topicId: string;
  };
  [EventType.HEDERA_TOPIC_UNSUBSCRIBED]: {
    topicId: string;
  };
  [EventType.HEDERA_TRANSACTION_SUBMITTED]: {
    transactionId: string;
    type: string;
  };
  [EventType.HEDERA_TRANSACTION_CONFIRMED]: {
    transactionId: string;
    type: string;
    receipt: any;
  };
  [EventType.HEDERA_TRANSACTION_FAILED]: {
    transactionId: string;
    type: string;
    error: Error;
  };
}

/**
 * Shared EventBus for cross-component communication
 * 
 * This is a singleton that can be imported and used across all components
 * to facilitate communication between the different parts of the unified
 * agent architecture.
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  
  private constructor() {
    super();
    // Set higher max listeners limit as we'll have multiple components
    this.setMaxListeners(50);
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Emit a typed event with payload
   */
  public emitEvent<T extends EventType>(event: T, payload: EventPayloads[T]): boolean {
    // Get all listeners for this event
    const listeners = this.listeners(event);
    
    // Call each listener with the payload, catching errors to prevent one bad handler
    // from stopping other handlers from being called
    listeners.forEach(listener => {
      try {
        (listener as any)(payload);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    
    return true;
  }
  
  /**
   * Listen for a typed event
   */
  public onEvent<T extends EventType>(
    event: T, 
    listener: (payload: EventPayloads[T]) => void
  ): this {
    return this.on(event, listener as any);
  }
  
  /**
   * Listen for a typed event once
   */
  public onceEvent<T extends EventType>(
    event: T, 
    listener: (payload: EventPayloads[T]) => void
  ): this {
    // Use a wrapper function for proper removal
    const wrappedListener = (payload: any) => {
      // Remove the listener before calling it to ensure it's only called once
      this.removeListener(event, wrappedListener);
      
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    };
    
    return this.on(event, wrappedListener);
  }
  
  /**
   * Remove a typed event listener
   */
  public offEvent<T extends EventType>(
    event: T, 
    listener: (payload: EventPayloads[T]) => void
  ): this {
    return this.off(event, listener as any);
  }
  
  /**
   * Log all events (useful for debugging)
   */
  public enableLogging(): void {
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