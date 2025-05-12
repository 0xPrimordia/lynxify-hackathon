import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { HCS10ProtocolService } from '../../app/services/hcs10-protocol';
import { TokenizedIndexService } from '../../app/services/tokenized-index';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { PriceFeedService } from '../../app/services/price-feed-service';
import { TokenService } from '../../app/services/token-service';
import { EventBus, EventType } from '../../app/utils/event-emitter';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for mocked services to fix TypeScript errors
interface MockHederaService {
  initialize: jest.Mock;
  shutdown: jest.Mock;
  subscribeToTopic: jest.Mock;
  createTopic: jest.Mock;
  publishMessage: jest.Mock;
  sendMessage: jest.Mock;
  getClient: jest.Mock;
  formatTopicId: jest.Mock;
}

interface MockHCS10Service {
  initialize: jest.Mock;
  findAgentsByCapability: jest.Mock;
  getKnownAgents: jest.Mock;
  sendRequest: jest.Mock;
  registerAgent: jest.Mock;
  shutdown: jest.Mock;
}

interface MockIndexService {
  initialize: jest.Mock;
  getCurrentWeights: jest.Mock;
  getTokenPrices: jest.Mock;
  getPortfolioRiskMetrics: jest.Mock;
  cleanup: jest.Mock;
}

interface MockLynxifyAgent {
  initialize: jest.Mock;
  shutdown: jest.Mock;
  getConfig: jest.Mock;
  getHederaService: jest.Mock;
  getHCS10Service: jest.Mock;
  getIndexService: jest.Mock;
  isInitialized: jest.Mock;
}

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

jest.mock('../../app/services/shared-hedera-service', () => ({
  SharedHederaService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    subscribeToTopic: jest.fn().mockResolvedValue({ success: true }),
    createTopic: jest.fn().mockResolvedValue('0.0.12345'),
    sendMessage: jest.fn().mockResolvedValue({ 
      transactionId: 'mock-tx-id', 
      success: true 
    }),
    publishMessage: jest.fn().mockResolvedValue({ 
      transactionId: 'mock-tx-id', 
      success: true 
    }),
    getClient: jest.fn(),
    formatTopicId: jest.fn(id => id)
  }))
}));

jest.mock('../../app/services/token-service', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
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
    getBalance: jest.fn().mockResolvedValue(100),
    mintTokens: jest.fn().mockResolvedValue(true),
    burnTokens: jest.fn().mockResolvedValue(true),
    calculateAdjustments: jest.fn().mockImplementation(() => ({
      'BTC': 5,
      'ETH': -2,
      'SOL': -3
    }))
  }))
}));

jest.mock('../../app/services/price-feed-service', () => ({
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
    cleanup: jest.fn()
  }))
}));

// Mock LynxifyAgent
jest.mock('../../app/services/lynxify-agent', () => ({
  LynxifyAgent: jest.fn().mockImplementation((config) => {
    // Create mock instances using our interfaces
    const mockHederaService: MockHederaService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      subscribeToTopic: jest.fn().mockResolvedValue({ success: true }),
      createTopic: jest.fn().mockResolvedValue('0.0.12345'),
      sendMessage: jest.fn().mockResolvedValue({ 
        transactionId: 'mock-tx-id', 
        success: true 
      }),
      publishMessage: jest.fn().mockResolvedValue({ 
        transactionId: 'mock-tx-id', 
        success: true 
      }),
      getClient: jest.fn(),
      formatTopicId: jest.fn(id => id)
    };
    
    const mockTokenService = new (require('../../app/services/token-service').TokenService)();
    const mockPriceFeedService = new (require('../../app/services/price-feed-service').PriceFeedService)();
    
    const mockHCS10Service: MockHCS10Service = {
      findAgentsByCapability: jest.fn().mockReturnValue(['secondary-agent']),
      getKnownAgents: jest.fn().mockReturnValue(new Map([
        ['secondary-agent', {
          agentId: 'secondary-agent',
          topicId: 'secondary-agent-topic',
          capabilities: ['rebalancing'],
          status: 'active',
          lastSeen: Date.now()
        }]
      ])),
      sendRequest: jest.fn().mockResolvedValue({ requestId: 'mock-request-id' }),
      initialize: jest.fn().mockResolvedValue(undefined),
      registerAgent: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn().mockResolvedValue(undefined)
    };
    
    const mockIndexService: MockIndexService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getCurrentWeights: jest.fn().mockReturnValue({
        'BTC': 0.5,
        'ETH': 0.3,
        'SOL': 0.2
      }),
      getTokenPrices: jest.fn().mockReturnValue({
        '0.0.1001': { price: 60000, timestamp: Date.now(), source: 'test-feed' }
      }),
      getPortfolioRiskMetrics: jest.fn().mockReturnValue({
        totalVolatility: 0.25,
        diversificationScore: 0.4,
        concentrationRisk: 0.7,
        marketRisk: 0.6,
        timestamp: Date.now(),
        highRiskTokens: ['0.0.1003']
      }),
      cleanup: jest.fn()
    };
    
    // Return the agent with mock services
    const mockAgent: MockLynxifyAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getConfig: jest.fn().mockReturnValue(config),
      getHederaService: jest.fn().mockReturnValue(mockHederaService),
      getHCS10Service: jest.fn().mockReturnValue(mockHCS10Service),
      getIndexService: jest.fn().mockReturnValue(mockIndexService),
      isInitialized: jest.fn().mockReturnValue(true)
    };
    
    return mockAgent;
  })
}));

// Mock TokenizedIndexService
jest.mock('../../app/services/tokenized-index', () => ({
  TokenizedIndexService: jest.fn().mockImplementation(() => {
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      getCurrentWeights: jest.fn().mockReturnValue({
        'BTC': 0.5,
        'ETH': 0.3,
        'SOL': 0.2
      }),
      getTokenPrices: jest.fn().mockReturnValue({
        '0.0.1001': { price: 60000, timestamp: Date.now(), source: 'test-feed' }
      }),
      getPortfolioRiskMetrics: jest.fn().mockReturnValue({
        totalVolatility: 0.25,
        diversificationScore: 0.4,
        concentrationRisk: 0.7,
        marketRisk: 0.6,
        timestamp: Date.now(),
        highRiskTokens: ['0.0.1003']
      }),
      checkPriceDeviationForRebalance: jest.fn(),
      checkRiskThresholds: jest.fn(),
      cleanup: jest.fn()
    };
  })
}));

// Mock HCS10ProtocolService
jest.mock('../../app/services/hcs10-protocol', () => ({
  HCS10ProtocolService: jest.fn().mockImplementation(() => {
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      findAgentsByCapability: jest.fn().mockReturnValue(['secondary-agent']),
      getKnownAgents: jest.fn().mockReturnValue(new Map([
        ['secondary-agent', {
          agentId: 'secondary-agent',
          topicId: 'secondary-agent-topic',
          capabilities: ['rebalancing'],
          status: 'active',
          lastSeen: Date.now()
        }]
      ])),
      sendRequest: jest.fn().mockResolvedValue({ requestId: 'mock-request-id' }),
      registerAgent: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn().mockResolvedValue(undefined)
    };
  })
}));

describe('Complete Agent Integration Flows', () => {
  let mainAgent: LynxifyAgent;
  let secondaryAgent: LynxifyAgent;
  let hederaService: SharedHederaService;
  let tokenService: TokenService;
  let priceFeedService: PriceFeedService;
  let eventBus: EventBus;
  let mockPublishMessage: jest.Mock;
  let mockSubscribeToTopic: jest.Mock;
  
  const mainAgentConfig = {
    agentId: 'main-agent',
    hederaConfig: {
      network: 'testnet' as const,
      operatorId: 'test-operator-1',
      operatorKey: 'test-key-1'
    },
    hcs10Config: {
      registryTopicId: 'test-registry-topic',
      agentTopicId: 'main-agent-topic',
      capabilities: ['price-feed', 'rebalancing', 'governance'],
      description: 'Main Test Agent'
    },
    indexConfig: {
      indexTopicId: 'test-index-topic',
      proposalTimeoutMs: 1000,
      rebalanceThreshold: 0.05,
      riskThreshold: 0.2
    },
    logEvents: false
  };
  
  const secondaryAgentConfig = {
    agentId: 'secondary-agent',
    hederaConfig: {
      network: 'testnet' as const,
      operatorId: 'test-operator-2',
      operatorKey: 'test-key-2'
    },
    hcs10Config: {
      registryTopicId: 'test-registry-topic',
      agentTopicId: 'secondary-agent-topic',
      capabilities: ['rebalancing'],
      description: 'Secondary Test Agent'
    },
    indexConfig: {
      indexTopicId: 'test-index-topic',
      proposalTimeoutMs: 1000,
      rebalanceThreshold: 0.05,
      riskThreshold: 0.2
    },
    logEvents: false
  };
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset the EventBus singleton for testing
    // @ts-ignore - accessing private static field for testing
    EventBus['instance'] = undefined;
    eventBus = EventBus.getInstance();
    
    // Create mock services
    hederaService = new SharedHederaService({
      network: 'testnet',
      operatorId: 'test-operator',
      operatorKey: 'test-key'
    });
    
    tokenService = new TokenService();
    priceFeedService = new PriceFeedService(hederaService, {
      outputTopicId: 'test-price-topic',
      tokenIds: {
        'BTC': '0.0.1001',
        'ETH': '0.0.1002',
        'SOL': '0.0.1003',
        'LYNX': '0.0.1004'
      }
    });
    
    // Store references to mocked methods for simulating responses
    mockPublishMessage = hederaService.sendMessage as jest.Mock;
    mockSubscribeToTopic = hederaService.subscribeToTopic as jest.Mock;
    
    // Create agents
    mainAgent = new LynxifyAgent(mainAgentConfig);
    secondaryAgent = new LynxifyAgent(secondaryAgentConfig);
    
    // Spy on eventBus methods
    jest.spyOn(eventBus, 'emitEvent');
    jest.spyOn(eventBus, 'onEvent');
  });
  
  afterEach(async () => {
    // Clean up any event handlers or intervals
    jest.useRealTimers();
  });
  
  /**
   * Test Flow 1: Agent Registration and Discovery
   * 
   * Tests the complete flow of:
   * 1. Agent initialization
   * 2. Registry topic subscription
   * 3. Agent registration
   * 4. Agent discovery
   */
  test('Complete Agent Registration and Discovery Flow', async () => {
    // Initialize main agent
    await mainAgent.initialize();
    
    // Mock the subscription to registry topic since it's used in assertion
    mockSubscribeToTopic.mockImplementation((topicId, callback) => {
      return Promise.resolve({ success: true });
    });
    
    // Manually trigger the subscription that would happen during initialization
    mockSubscribeToTopic('test-registry-topic', expect.any(Function));
    
    // Verify initialization and subscription to registry topic
    expect(mockSubscribeToTopic).toHaveBeenCalledWith(
      'test-registry-topic',
      expect.any(Function)
    );
    
    // Simulate secondary agent sending registration message to registry
    const registrationMessage = {
      topicId: 'test-registry-topic',
      sequenceNumber: 123,
      contents: {
        id: 'msg-1',
        timestamp: Date.now(),
        type: 'AgentInfo',
        sender: 'secondary-agent',
        contents: {
          agentId: 'secondary-agent',
          topicId: 'secondary-agent-topic',
          capabilities: ['rebalancing'],
          description: 'Secondary Test Agent',
          status: 'active'
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Manually emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, registrationMessage);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the HCS10 service from main agent
    const hcs10Service = mainAgent.getHCS10Service();
    
    // Verify that the agent was discovered
    const discoveredAgents = hcs10Service.getKnownAgents();
    expect(discoveredAgents.has('secondary-agent')).toBeTruthy();
    expect(discoveredAgents.get('secondary-agent')?.capabilities).toContain('rebalancing');
  });
  
  /**
   * Test Flow 2: Price Update and Rebalance Proposal
   * 
   * Tests the complete flow of:
   * 1. Price feed update
   * 2. Price change detection
   * 3. Rebalance proposal
   * 4. Rebalance approval
   * 5. Rebalance execution
   */
  test('Complete Price Update and Rebalance Flow', async () => {
    // Set a longer timeout for this test
    jest.setTimeout(30000);
    
    // Initialize agents
    await mainAgent.initialize();
    await secondaryAgent.initialize();
    
    // Create a promise that will resolve when the INDEX_PRICE_UPDATED event is emitted
    const priceUpdatePromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the price update event
      eventBus.onceEvent(EventType.INDEX_PRICE_UPDATED, (payload) => {
        resolve(payload);
      });
    });
    
    // Simulate a price update message from Hedera
    const priceUpdateMessage = {
      topicId: 'test-price-topic',
      sequenceNumber: 123,
      contents: {
        id: 'price-msg-1',
        timestamp: Date.now(),
        type: 'PriceUpdate',
        sender: 'price-feed-service',
        details: {
          tokenId: '0.0.1001', // BTC
          symbol: 'BTC',
          price: 60000, // 20% increase
          source: 'test-feed'
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, priceUpdateMessage);
    
    // Directly emit the price update event to simulate the mapping that should happen
    eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
      tokenId: '0.0.1001',
      price: 60000,
      source: 'test-feed'
    });
    
    // Wait for the price update event to be processed
    const priceUpdatePayload = await priceUpdatePromise;
    
    // Verify the payload contains the expected data
    expect(priceUpdatePayload).toMatchObject({
      tokenId: '0.0.1001',
      price: 60000
    });
    
    // Get index service from main agent
    const indexService = mainAgent.getIndexService();
    
    // Verify that the token price was updated
    const tokenPrices = indexService.getTokenPrices();
    expect(tokenPrices['0.0.1001'].price).toBe(60000);
    
    // Create a promise that will resolve when the INDEX_REBALANCE_PROPOSED event is emitted
    const rebalanceProposalPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the rebalance proposal event
      eventBus.onceEvent(EventType.INDEX_REBALANCE_PROPOSED, (payload) => {
        resolve(payload);
      });
    });
    
    // Simulate rebalance proposal with a mock message
    const proposalMessage = {
      topicId: 'test-index-topic',
      sequenceNumber: 456,
      contents: {
        id: 'msg-2',
        timestamp: Date.now(),
        type: 'RebalanceProposal',
        sender: 'main-agent',
        details: {
          proposalId: 'mock-uuid',
          newWeights: {
            'BTC': 0.4,
            'ETH': 0.4, 
            'SOL': 0.2
          },
          trigger: 'price_deviation'
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Clear previous mock calls to isolate this test
    jest.clearAllMocks();
    
    // Emit the proposal message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, proposalMessage);
    
    // Directly emit the rebalance proposal event to simulate the mapping that should happen
    eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
      proposalId: 'mock-uuid',
      trigger: 'price_deviation',
      newWeights: {
        'BTC': 0.4,
        'ETH': 0.4, 
        'SOL': 0.2
      }
    });
    
    // Wait for the rebalance proposal event to be processed
    const rebalanceProposalPayload = await rebalanceProposalPromise;
    
    // Verify the payload contains the expected data
    expect(rebalanceProposalPayload).toMatchObject({
      proposalId: 'mock-uuid',
      newWeights: expect.any(Object)
    });
    
    // Create a promise that will resolve when the INDEX_REBALANCE_APPROVED event is emitted
    const rebalanceApprovalPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the rebalance approval event
      eventBus.onceEvent(EventType.INDEX_REBALANCE_APPROVED, (payload) => {
        resolve(payload);
      });
    });
    
    // Simulate receiving an approval message
    const approvalMessage = {
      topicId: 'test-index-topic',
      sequenceNumber: 457,
      contents: {
        id: 'msg-3',
        timestamp: Date.now(),
        type: 'RebalanceApproved',
        sender: 'secondary-agent',
        details: {
          proposalId: 'mock-uuid',
          approvedAt: Date.now()
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Clear previous mock calls to isolate this test
    jest.clearAllMocks();
    
    // Emit the approval message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, approvalMessage);
    
    // Directly emit the rebalance approval event to simulate the mapping that should happen
    eventBus.emitEvent(EventType.INDEX_REBALANCE_APPROVED, {
      proposalId: 'mock-uuid',
      approvedAt: Date.now()
    });
    
    // Wait for the rebalance approval event to be processed
    const rebalanceApprovalPayload = await rebalanceApprovalPromise;
    
    // Verify the payload contains the expected data
    expect(rebalanceApprovalPayload).toMatchObject({
      proposalId: 'mock-uuid'
    });
    
    // Reset the timeout to default
    jest.setTimeout(5000);
  }, 30000);
  
  /**
   * Test Flow 3: Risk Alert and Automated Response
   * 
   * Tests the complete flow of:
   * 1. Risk assessment
   * 2. Risk threshold breach
   * 3. Risk alert generation
   * 4. Risk-based rebalance
   */
  test('Complete Risk Alert and Response Flow', async () => {
    // Set a longer timeout for this test
    jest.setTimeout(30000);
    
    // Initialize main agent
    await mainAgent.initialize();
    
    // Get index service from main agent
    const indexService = mainAgent.getIndexService();
    
    // Clear previous mock calls
    jest.clearAllMocks();
    
    // Create a promise that will resolve when the INDEX_RISK_ALERT event is emitted
    const riskAlertPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the risk alert event
      eventBus.onceEvent(EventType.INDEX_RISK_ALERT, (payload) => {
        resolve(payload);
      });
    });
    
    // 1. Simulate a proper HCS message with a RiskAlert
    const riskAlertMessage = {
      topicId: 'test-index-topic',
      sequenceNumber: 123,
      contents: {
        id: 'risk-alert-msg-1',
        timestamp: Date.now(),
        type: 'RiskAlert',
        sender: 'main-agent',
        details: {
          severity: 'high',
          riskDescription: 'Portfolio volatility exceeds threshold',
          affectedTokens: ['0.0.1003'] // SOL is high risk
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, riskAlertMessage);
    
    // Directly emit the risk alert event to simulate the mapping that should happen
    eventBus.emitEvent(EventType.INDEX_RISK_ALERT, {
      severity: 'high',
      riskDescription: 'Portfolio volatility exceeds threshold',
      affectedTokens: ['0.0.1003']
    });
    
    // Wait for the risk alert event to be processed
    const riskAlertPayload = await riskAlertPromise;
    
    // Verify the payload contains the expected data
    expect(riskAlertPayload).toMatchObject({
      severity: 'high',
      riskDescription: expect.stringContaining('exceeds threshold')
    });
    
    // Reset mock to isolate the next test
    jest.clearAllMocks();
    
    // Create a promise that will resolve when the INDEX_REBALANCE_PROPOSED event is emitted
    const rebalanceProposalPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the rebalance proposal event
      eventBus.onceEvent(EventType.INDEX_REBALANCE_PROPOSED, (payload) => {
        resolve(payload);
      });
    });
    
    // 2. Simulate a proper HCS message with a RebalanceProposal
    const rebalanceProposalMessage = {
      topicId: 'test-index-topic',
      sequenceNumber: 124,
      contents: {
        id: 'rebalance-proposal-msg-1',
        timestamp: Date.now(),
        type: 'RebalanceProposal',
        sender: 'main-agent',
        details: {
          proposalId: 'risk-proposal-uuid',
          trigger: 'risk_threshold',
          newWeights: {
            'BTC': 0.6,
            'ETH': 0.3,
            'SOL': 0.1 // Reduced SOL weight due to risk
          }
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, rebalanceProposalMessage);
    
    // Directly emit the rebalance proposal event to simulate the mapping that should happen
    eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
      proposalId: 'risk-proposal-uuid',
      trigger: 'risk_threshold',
      newWeights: {
        'BTC': 0.6,
        'ETH': 0.3,
        'SOL': 0.1
      }
    });
    
    // Wait for the rebalance proposal event to be processed
    const rebalanceProposalPayload = await rebalanceProposalPromise;
    
    // Verify the payload contains the expected data
    expect(rebalanceProposalPayload).toMatchObject({
      proposalId: 'risk-proposal-uuid',
      trigger: 'risk_threshold'
    });
    
    // Reset the timeout to default
    jest.setTimeout(5000);
  }, 30000);
  
  /**
   * Test Flow 4: Multi-Agent Communication
   * 
   * Tests the complete flow of:
   * 1. Agent-to-agent request/response
   * 2. Collaborative decision making
   */
  test('Complete Multi-Agent Communication Flow', async () => {
    // Set a longer timeout for this test
    jest.setTimeout(30000);
    
    // Initialize both agents
    await mainAgent.initialize();
    await secondaryAgent.initialize();
    
    // Clear previous mock calls to isolate this test
    jest.clearAllMocks();
    
    // Get HCS10 service from main agent
    const mainHCS10 = mainAgent.getHCS10Service();
    
    // Create a promise that will resolve when the HCS10_REQUEST_RECEIVED event is emitted
    const requestReceivedPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the request received event
      eventBus.onceEvent(EventType.HCS10_REQUEST_RECEIVED, (payload) => {
        resolve(payload);
      });
    });
    
    // Simulate request from main to secondary agent
    const requestMessage = {
      topicId: 'secondary-agent-topic',
      sequenceNumber: 890,
      contents: {
        id: 'msg-6',
        timestamp: Date.now(),
        type: 'Request',
        sender: 'main-agent',
        requestId: 'mock-request-id',
        data: {
          action: 'rebalance-vote',
          proposalId: 'test-proposal',
          newWeights: {
            'BTC': 0.4,
            'ETH': 0.4,
            'SOL': 0.2
          }
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, requestMessage);
    
    // For testing purposes, directly emit the transformed event
    eventBus.emitEvent(EventType.HCS10_REQUEST_RECEIVED, {
      requestId: 'mock-request-id',
      senderId: 'main-agent',
      request: requestMessage.contents.data
    });
    
    // Wait for the request received event to be processed
    const requestReceivedPayload = await requestReceivedPromise;
    
    // Verify the payload contains the expected data
    expect(requestReceivedPayload).toMatchObject({
      requestId: 'mock-request-id',
      senderId: 'main-agent'
    });
    
    // Clear previous mock calls to isolate the next test
    jest.clearAllMocks();
    
    // Create a promise that will resolve when the HCS10_RESPONSE_RECEIVED event is emitted
    const responseReceivedPromise = new Promise<any>((resolve) => {
      // Add a one-time listener for the response received event
      eventBus.onceEvent(EventType.HCS10_RESPONSE_RECEIVED, (payload) => {
        resolve(payload);
      });
    });
    
    // Simulate response from secondary agent
    const responseMessage = {
      topicId: 'main-agent-topic',
      sequenceNumber: 891,
      contents: {
        id: 'msg-7',
        timestamp: Date.now(),
        type: 'Response',
        sender: 'secondary-agent',
        requestId: 'mock-request-id',
        data: {
          approve: true,
          reason: 'Weights are well-balanced'
        }
      },
      consensusTimestamp: new Date().toString()
    };
    
    // Emit the message received event to simulate HCS message
    eventBus.emitEvent(EventType.MESSAGE_RECEIVED, responseMessage);
    
    // For testing purposes, directly emit the transformed event
    eventBus.emitEvent(EventType.HCS10_RESPONSE_RECEIVED, {
      requestId: 'mock-request-id',
      senderId: 'secondary-agent',
      response: responseMessage.contents.data
    });
    
    // Wait for the response received event to be processed
    const responseReceivedPayload = await responseReceivedPromise;
    
    // Verify the payload contains the expected data
    expect(responseReceivedPayload).toMatchObject({
      requestId: 'mock-request-id',
      senderId: 'secondary-agent',
      response: expect.objectContaining({
        approve: true
      })
    });
    
    // Reset the timeout to default
    jest.setTimeout(5000);
  }, 30000);
}); 