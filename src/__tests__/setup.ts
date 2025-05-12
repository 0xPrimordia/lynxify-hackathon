import dotenv from 'dotenv';

// Load environment variables from .env.test
dotenv.config({ path: '.env.test' });

// Set mock environment variables for tests - using proper Hedera ID formats
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.12345';
// Use a mock private key in a format that will pass validation
process.env.OPERATOR_KEY = '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c97732394482538e10';
process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.12346';
process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.12347';
process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.12348';
// Also set legacy env vars needed by some tests
process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID = '0.0.12346';
process.env.NEXT_PUBLIC_AGENT_TOPIC_ID = '0.0.12347';
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3001';
// Set this to true for tests to bypass topic validation
process.env.BYPASS_TOPIC_CHECK = 'true';
// Add the missing NEXT_PUBLIC_NETWORK variable
process.env.NEXT_PUBLIC_NETWORK = 'testnet';

// Define the type of the mock EventBus
interface MockEventBus {
  emitEvent: jest.Mock;
  originalEmitEvent?: jest.Mock;
  onEvent: jest.Mock;
  offEvent: jest.Mock;
  onceEvent: jest.Mock;
  getInstance: jest.Mock;
  eventListeners: Map<string, Function[]>;
}

// Create a mock EventBus implementation
const mockEventBus: MockEventBus = {
  emitEvent: jest.fn(),
  originalEmitEvent: jest.fn(),
  onEvent: jest.fn(),
  offEvent: jest.fn(),
  onceEvent: jest.fn(),
  getInstance: jest.fn(),
  eventListeners: new Map<string, Function[]>()
};

// Create a wrapper for the emitEvent method that properly formats different event types
const wrappedEmitEvent = jest.fn((eventType, payload) => {
  // Store the original call
  if (mockEventBus.originalEmitEvent) {
    mockEventBus.originalEmitEvent(eventType, payload);
  }
  
  // Handle message received events: translate to specific event types
  if (eventType === 'message:received' && payload && payload.contents) {
    // Map message types to event types
    const messageTypeToEventType: Record<string, string> = {
      'RiskAlert': 'index:risk:alert',
      'RebalanceProposal': 'index:rebalance:proposed',
      'RebalanceApproved': 'index:rebalance:approved',
      'RebalanceExecuted': 'index:rebalance:executed',
      'PriceUpdate': 'index:price:updated'
    };
    
    // Check if we need to convert this to a specific event
    const messageType = payload.contents.type;
    
    if (messageType && messageTypeToEventType[messageType]) {
      // Extract the relevant data from the message contents
      const details = payload.contents.details || {};
      
      // For Risk Alert - format detailed payload to match expectations
      if (messageType === 'RiskAlert') {
        wrappedEmitEvent(messageTypeToEventType[messageType], {
          severity: details.severity,
          riskDescription: details.riskDescription,
          affectedTokens: details.affectedTokens,
          messageId: payload.contents.id,
          timestamp: payload.contents.timestamp,
          source: payload.contents.sender
        });
      }
      // For RebalanceProposal - format detailed payload to match expectations 
      else if (messageType === 'RebalanceProposal') {
        wrappedEmitEvent(messageTypeToEventType[messageType], {
          proposalId: details.proposalId,
          trigger: details.trigger,
          newWeights: details.newWeights || {},
          messageId: payload.contents.id,
          timestamp: payload.contents.timestamp,
          source: payload.contents.sender
        });
      }
      // For RebalanceApproved - format detailed payload to match expectations
      else if (messageType === 'RebalanceApproved') {
        wrappedEmitEvent(messageTypeToEventType[messageType], {
          proposalId: details.proposalId,
          approvedAt: details.approvedAt,
          messageId: payload.contents.id,
          timestamp: payload.contents.timestamp,
          source: payload.contents.sender
        });
      }
      // For PriceUpdate - format detailed payload to match expectations
      else if (messageType === 'PriceUpdate') {
        wrappedEmitEvent(messageTypeToEventType[messageType], {
          tokenId: details.tokenId,
          price: details.price,
          source: details.source,
          messageId: payload.contents.id,
          timestamp: payload.contents.timestamp
        });
      }
      // For other events, emit a generic formatted payload
      else {
        wrappedEmitEvent(messageTypeToEventType[messageType], {
          ...details,
          messageId: payload.contents.id,
          timestamp: payload.contents.timestamp,
          source: payload.contents.sender
        });
      }
    }
    
    // Map Request/Response messages to HCS10 event types
    if (payload.contents.type === 'Request') {
      const requestData = {
        requestId: payload.contents.requestId || payload.contents.id,
        senderId: payload.contents.sender,
        request: payload.contents.data
      };
      
      // Emit the HCS10 specific event
      wrappedEmitEvent('hcs10:request:received', requestData);
    }
    
    if (payload.contents.type === 'Response') {
      const responseData = {
        requestId: payload.contents.requestId || payload.contents.id,
        senderId: payload.contents.sender,
        response: payload.contents.data
      };
      
      // Emit the HCS10 specific event
      wrappedEmitEvent('hcs10:response:received', responseData);
    }
  }
  
  // Make sure payload is properly set for message:received events 
  if (eventType === 'message:received' && payload) {
    // Make sure the payload structure matches what the tests expect
    if (payload.topic && !payload.topicId) {
      payload.topicId = payload.topic;
    }
    
    // For HCS messages, make sure message is accessible as contents
    if (payload.message && !payload.contents) {
      payload.contents = payload.message;
    }
  }
  
  // Execute any event listeners for this event type
  const listeners = mockEventBus.eventListeners.get(eventType) || [];
  listeners.forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      console.error(`Error executing listener for ${eventType}:`, error);
    }
  });
  
  return mockEventBus;
});

// Override the emitEvent function with our wrapped version
mockEventBus.emitEvent = wrappedEmitEvent;

// Updated implementation of onceEvent
mockEventBus.onceEvent = jest.fn((eventType, handler) => {
  // Get or create the listeners array for this event type
  if (!mockEventBus.eventListeners.has(eventType)) {
    mockEventBus.eventListeners.set(eventType, []);
  }
  
  // Create a wrapper function that will remove itself after first execution
  const wrappedHandler = (payload: any) => {
    // Remove the handler from the listeners
    const listeners = mockEventBus.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(wrappedHandler);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    // Call the original handler
    handler(payload);
  };
  
  // Add the wrapped handler to the listeners
  const listeners = mockEventBus.eventListeners.get(eventType) || [];
  listeners.push(wrappedHandler);
  
  // Return the EventBus for method chaining
  return mockEventBus;
});

// Updated implementation of onEvent
mockEventBus.onEvent = jest.fn((eventType, handler) => {
  // Get or create the listeners array for this event type
  if (!mockEventBus.eventListeners.has(eventType)) {
    mockEventBus.eventListeners.set(eventType, []);
  }
  
  // Add the handler to the listeners
  const listeners = mockEventBus.eventListeners.get(eventType) || [];
  listeners.push(handler);
  
  // Return the EventBus for method chaining
  return mockEventBus;
});

// Mock the event-emitter module
jest.mock('../app/utils/event-emitter', () => {
  return {
    EventBus: {
      getInstance: jest.fn().mockReturnValue(mockEventBus)
    },
    EventType: {
      // Add all the event types needed for testing
      INDEX_RISK_ALERT: 'index:risk:alert',
      INDEX_REBALANCE_PROPOSED: 'index:rebalance:proposed',
      INDEX_REBALANCE_APPROVED: 'index:rebalance:approved',
      INDEX_REBALANCE_EXECUTED: 'index:rebalance:executed',
      INDEX_PRICE_UPDATED: 'index:price:updated',
      MESSAGE_RECEIVED: 'message:received',
      HCS10_REQUEST_RECEIVED: 'hcs10:request:received',
      HCS10_RESPONSE_RECEIVED: 'hcs10:response:received'
    }
  };
});

// Create a mock SharedHederaService implementation
const mockSharedHederaService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
  subscribeToTopic: jest.fn().mockResolvedValue(undefined),
  createTopic: jest.fn().mockResolvedValue('0.0.12345'),
  sendMessage: jest.fn().mockResolvedValue({ 
    transactionId: 'mock-tx-id', 
    success: true 
  }),
  publishMessage: jest.fn().mockResolvedValue({ 
    transactionId: 'mock-tx-id', 
    success: true 
  }),
  getClient: jest.fn().mockReturnValue({
    setOperator: jest.fn(),
    setMaxQueryPayment: jest.fn()
  }),
  formatTopicId: jest.fn(id => id),
  isConnected: jest.fn().mockReturnValue(true),
  getTopicStatus: jest.fn().mockReturnValue({
    hasGovernanceTopic: true,
    hasPriceFeedTopic: true,
    hasAgentActionsTopic: true
  }),
  topics: {
    GOVERNANCE: '0.0.12346',
    PRICE_FEED: '0.0.12348',
    AGENT_ACTIONS: '0.0.12347'
  }
};

// Mock the shared-hedera-service module
jest.mock('../app/services/shared-hedera-service', () => {
  // Create a mock for PrivateKey from @hashgraph/sdk
  class MockPrivateKey {
    private keyString: string;
    
    constructor(key: string) {
      this.keyString = key;
    }
    
    toString(): string {
      return this.keyString;
    }
    
    static fromString(keyString: string): MockPrivateKey {
      return new MockPrivateKey(keyString);
    }
  }
  
  // Mock the @hashgraph/sdk module
  jest.mock('@hashgraph/sdk', () => {
    return {
      Client: {
        forTestnet: jest.fn().mockReturnValue({
          setOperator: jest.fn(),
          setMaxQueryPayment: jest.fn()
        })
      },
      PrivateKey: MockPrivateKey,
      TopicId: {
        fromString: jest.fn(id => ({ toString: () => id }))
      },
      AccountId: {
        fromString: jest.fn(id => ({ toString: () => id }))
      }
    };
  });
  
  return {
    SharedHederaService: jest.fn().mockImplementation(() => mockSharedHederaService),
    sharedHederaService: mockSharedHederaService,
    __esModule: true
  };
});

// Mock the TokenService
jest.mock('../app/services/token-service', () => {
  const mockTokenService = {
    getTokenId: jest.fn().mockImplementation((symbol: string) => {
      const mockTokenIds: Record<string, string> = {
        'BTC': '0.0.1001',
        'ETH': '0.0.1002',
        'SOL': '0.0.1003',
        'LYNX': '0.0.1004'
      };
      return mockTokenIds[symbol] || null;
    }),
    getAllTokenIds: jest.fn().mockReturnValue({
      'BTC': '0.0.1001',
      'ETH': '0.0.1002',
      'SOL': '0.0.1003',
      'LYNX': '0.0.1004'
    }),
    getTokenBalances: jest.fn().mockResolvedValue({
      'BTC': 10,
      'ETH': 50,
      'SOL': 500,
      'LYNX': 1000
    }),
    mintTokens: jest.fn().mockResolvedValue(true),
    burnTokens: jest.fn().mockResolvedValue(true)
  };
  
  return {
    TokenService: jest.fn().mockImplementation(() => mockTokenService),
    __esModule: true
  };
});

// Mock HederaService methods
jest.mock('@/app/services/hedera', () => {
  // Mock the TOPICS constant to bypass validation
  const TOPICS = {
    GOVERNANCE_PROPOSALS: '0.0.12346',
    MARKET_PRICE_FEED: '0.0.12348',
    AGENT_ACTIONS: '0.0.12347'
  };
  
  const mockHederaService = {
    // Mock properties
    client: jest.fn(),
    subscriptions: new Map(),
    messageHandlers: new Map(),
    
    // Mock methods
    createGovernanceTopic: jest.fn().mockResolvedValue('0.0.12346'),
    createAgentTopic: jest.fn().mockResolvedValue('0.0.12347'),
    createPriceFeedTopic: jest.fn().mockResolvedValue('0.0.12348'),
    publishHCSMessage: jest.fn().mockResolvedValue(undefined),
    submitMessageToTopic: jest.fn().mockResolvedValue({}),
    publishMessage: jest.fn().mockResolvedValue(undefined), // Legacy method for tests
    subscribeToTopic: jest.fn().mockResolvedValue(undefined),
    unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
    getTopicMessages: jest.fn().mockResolvedValue([]),
    proposeRebalance: jest.fn().mockResolvedValue(undefined),
    approveRebalance: jest.fn().mockResolvedValue(undefined),
    executeRebalance: jest.fn().mockResolvedValue(undefined),
    getCurrentPortfolioWeights: jest.fn().mockReturnValue({
      'HBAR': 0.3,
      'BTC': 0.3,
      'ETH': 0.4
    }),
  };
  
  return {
    HederaService: jest.fn().mockImplementation(() => mockHederaService),
    __esModule: true,
    TOPICS: TOPICS,
    TOPIC_IDS: TOPICS
  };
});

// Mock all Hedera SDK components
jest.mock('@hashgraph/sdk', () => {
  // Mock implementation for proper PrivateKey validation
  class MockPrivateKey {
    private keyValue: string;

    constructor(key: string) {
      this.keyValue = key;
    }

    toString(): string {
      return this.keyValue;
    }

    static fromString(keyString: string): MockPrivateKey {
      // This validation function simulates the SDK's validation without actually requiring a real key
      // It just needs to accept our test key and return a valid object
      if (typeof keyString !== 'string') {
        throw new Error('private key cannot be decoded from bytes: invalid private key');
      }
      return new MockPrivateKey(keyString);
    }
  }

  const mockTopicId = {
    toString: jest.fn().mockReturnValue('0.0.12345')
  };
  
  return {
    Client: {
      forTestnet: jest.fn().mockReturnValue({
        setOperator: jest.fn().mockReturnThis(),
        setMaxQueryPayment: jest.fn().mockReturnThis()
      }),
      forNetwork: jest.fn().mockReturnValue({
        setOperator: jest.fn().mockReturnThis(),
        setMaxQueryPayment: jest.fn().mockReturnThis()
      })
    },
    AccountId: {
      fromString: jest.fn().mockReturnValue({ toString: () => '0.0.12345' })
    },
    PrivateKey: MockPrivateKey,
    TopicId: {
      fromString: jest.fn().mockReturnValue(mockTopicId)
    },
    TopicCreateTransaction: jest.fn().mockImplementation(() => ({
      setTopicMemo: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        getReceipt: jest.fn().mockResolvedValue({ topicId: mockTopicId })
      })
    })),
    TopicMessageSubmitTransaction: jest.fn().mockImplementation(() => ({
      setTopicId: jest.fn().mockReturnThis(),
      setMessage: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        getReceipt: jest.fn().mockResolvedValue({}),
        toString: jest.fn().mockReturnValue('transaction@123')
      })
    })),
    TopicMessageQuery: jest.fn().mockImplementation(() => ({
      setTopicId: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({
        unsubscribe: jest.fn()
      })
    })),
    Hbar: jest.fn().mockImplementation(() => ({
      toString: jest.fn().mockReturnValue('2 ℏ')
    })),
  };
});

// Mock the message store
jest.mock('@/app/services/message-store', () => {
  return {
    addMessage: jest.fn(),
    getMessages: jest.fn().mockReturnValue([]),
    getAllMessages: jest.fn().mockReturnValue([]),
    __esModule: true,
    default: {
      addMessage: jest.fn(),
      getMessages: jest.fn().mockReturnValue([]),
      getAllMessages: jest.fn().mockReturnValue([]),
    }
  };
});

// Mock the agent classes
jest.mock('@/app/services/agents/price-feed-agent', () => {
  return {
    PriceFeedAgent: jest.fn().mockImplementation(() => ({
      id: 'price-feed-agent',
      isRunning: false,
      start: function(this: { isRunning: boolean }) {
        if (this.isRunning) {
          throw new Error(`Agent price-feed-agent is already running`);
        }
        this.isRunning = true;
        return Promise.resolve();
      },
      stop: function(this: { isRunning: boolean }) {
        if (!this.isRunning) {
          throw new Error(`Agent price-feed-agent is not running`);
        }
        this.isRunning = false;
        return Promise.resolve();
      },
      publishMessage: jest.fn().mockResolvedValue(undefined),
      handleMessage: jest.fn().mockResolvedValue(undefined),
      onPriceUpdate: jest.fn(),
    })),
    __esModule: true,
  };
});

jest.mock('@/app/services/agents/risk-assessment-agent', () => {
  return {
    RiskAssessmentAgent: jest.fn().mockImplementation(() => ({
      id: 'risk-assessment-agent',
      isRunning: false,
      start: function(this: { isRunning: boolean }) {
        if (this.isRunning) {
          throw new Error(`Agent risk-assessment-agent is already running`);
        }
        this.isRunning = true;
        return Promise.resolve();
      },
      stop: function(this: { isRunning: boolean }) {
        if (!this.isRunning) {
          throw new Error(`Agent risk-assessment-agent is not running`);
        }
        this.isRunning = false;
        return Promise.resolve();
      },
      publishMessage: jest.fn().mockResolvedValue(undefined),
      handleMessage: jest.fn().mockResolvedValue(undefined),
      handlePriceUpdate: jest.fn().mockResolvedValue(undefined),
    })),
    __esModule: true,
  };
});

jest.mock('@/app/services/agents/rebalance-agent', () => {
  return {
    RebalanceAgent: jest.fn().mockImplementation(() => ({
      id: 'rebalance-agent',
      isRunning: false,
      start: function(this: { isRunning: boolean }) {
        if (this.isRunning) {
          throw new Error(`Agent rebalance-agent is already running`);
        }
        this.isRunning = true;
        return Promise.resolve();
      },
      stop: function(this: { isRunning: boolean }) {
        if (!this.isRunning) {
          throw new Error(`Agent rebalance-agent is not running`);
        }
        this.isRunning = false;
        return Promise.resolve();
      },
      publishMessage: jest.fn().mockResolvedValue(undefined),
      handleMessage: jest.fn().mockResolvedValue(undefined),
      handleRebalanceApproval: jest.fn().mockResolvedValue(undefined),
      handleRiskAlert: jest.fn().mockResolvedValue(undefined),
    })),
    __esModule: true,
  };
});

jest.mock('@/app/services/agents/agent-manager', () => {
  const manager = {
    active: false,
    start: function(this: { active: boolean }) {
      if (this.active) {
        throw new Error('Agent manager is already running');
      }
      this.active = true;
      return Promise.resolve();
    },
    stop: function(this: { active: boolean }) {
      if (!this.active) {
        throw new Error('Agent manager is not running');
      }
      this.active = false;
      return Promise.resolve();
    },
    isActive: function(this: { active: boolean }) {
      return this.active;
    },
  };
  
  return {
    AgentManager: jest.fn().mockReturnValue(manager),
    __esModule: true,
    default: manager,
  };
});

// Mock the base agent class
jest.mock('@/app/services/agents/base-agent', () => {
  return {
    BaseAgent: jest.fn().mockImplementation(() => ({
      id: 'test-agent',
      isRunning: false,
      start: function(this: { isRunning: boolean }) {
        if (this.isRunning) {
          throw new Error(`Agent test-agent is already running`);
        }
        this.isRunning = true;
        return Promise.resolve();
      },
      stop: function(this: { isRunning: boolean }) {
        if (!this.isRunning) {
          throw new Error(`Agent test-agent is not running`);
        }
        this.isRunning = false;
        return Promise.resolve();
      },
      publishMessage: function(this: { isRunning: boolean }, message: any) {
        if (!this.isRunning) {
          return Promise.reject(new Error(`Agent test-agent is not running`));
        }
        return Promise.resolve();
      },
    })),
    __esModule: true,
  };
});

// Mock WebSocket 
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((data: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState = 0;
  
  constructor(url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 100);
  }
  
  send(data: string) {
    // Mock implementation
  }
  
  close() {
    // Mock implementation
    if (this.onclose) this.onclose();
  }
}

// Set global WebSocket mock
global.WebSocket = MockWebSocket as any;

// Mock timers for scheduled tasks
jest.useFakeTimers();

// Mock console methods to keep test output clean
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Only mock console in test environment
if (process.env.NODE_ENV === 'test') {
  Object.assign(console, mockConsole);
}

// Add OpenAI shims for Node environment
import 'openai/shims/node';

// Setup global mocks that are needed for all tests
beforeAll(() => {
  // Silence console logs during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  
  // Keep warnings and errors for debugging
  // jest.spyOn(console, 'warn').mockImplementation(() => {});
  // jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console functions
  jest.restoreAllMocks();
});

// Mock the PriceFeedService
jest.mock('../app/services/price-feed-service', () => {
  return {
    PriceFeedService: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getLatestPrice: jest.fn().mockImplementation((symbol: string) => {
        const mockPrices: Record<string, any> = {
          'BTC': { symbol: 'BTC', tokenId: '0.0.1001', price: 50000, timestamp: Date.now(), source: 'test' },
          'ETH': { symbol: 'ETH', tokenId: '0.0.1002', price: 3000, timestamp: Date.now(), source: 'test' },
          'SOL': { symbol: 'SOL', tokenId: '0.0.1003', price: 100, timestamp: Date.now(), source: 'test' },
          'LYNX': { symbol: 'LYNX', tokenId: '0.0.1004', price: 5, timestamp: Date.now(), source: 'test' }
        };
        return mockPrices[symbol] || null;
      }),
      getAllLatestPrices: jest.fn().mockReturnValue({
        'BTC': { symbol: 'BTC', tokenId: '0.0.1001', price: 50000, timestamp: Date.now(), source: 'test' },
        'ETH': { symbol: 'ETH', tokenId: '0.0.1002', price: 3000, timestamp: Date.now(), source: 'test' },
        'SOL': { symbol: 'SOL', tokenId: '0.0.1003', price: 100, timestamp: Date.now(), source: 'test' },
        'LYNX': { symbol: 'LYNX', tokenId: '0.0.1004', price: 5, timestamp: Date.now(), source: 'test' }
      }),
      getPriceHistory: jest.fn().mockReturnValue([
        { symbol: 'BTC', tokenId: '0.0.1001', price: 49000, timestamp: Date.now() - 86400000, source: 'test' },
        { symbol: 'BTC', tokenId: '0.0.1001', price: 50000, timestamp: Date.now(), source: 'test' }
      ]),
      isInitialized: jest.fn().mockReturnValue(true),
      cleanup: jest.fn(),
      updateAllPrices: jest.fn().mockResolvedValue(undefined) // Add this to prevent infinite loops
    }))
  };
}); 