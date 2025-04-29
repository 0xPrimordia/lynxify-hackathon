import dotenv from 'dotenv';

// Load environment variables from .env.test
dotenv.config({ path: '.env.test' });

// Mock environment variables for tests - using proper Hedera ID formats
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.12345';
process.env.OPERATOR_KEY = '302e020100300506032b65700422042012a74694c437e489e97ef63cd1b43887ca2b953124bd0b7c772bdd3079dc3bb';
process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.12346';
process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.12347';
process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.12348';
// Also set legacy env vars needed by some tests
process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID = '0.0.12346';
process.env.NEXT_PUBLIC_AGENT_TOPIC_ID = '0.0.12347';
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3001';
// Set this to true for tests to bypass topic validation
process.env.BYPASS_TOPIC_CHECK = 'true';

// Mock HederaService methods
jest.mock('@/app/services/hedera', () => {
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
  };
});

// Mock all Hedera SDK components
jest.mock('@hashgraph/sdk', () => {
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
    PrivateKey: {
      fromString: jest.fn().mockReturnValue({ toString: () => 'mock-private-key' })
    },
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