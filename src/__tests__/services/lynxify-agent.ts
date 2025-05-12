import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { HCS10ProtocolService } from '../../app/services/hcs10-protocol';
import { TokenizedIndexService } from '../../app/services/tokenized-index';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { EventBus, EventType } from '../../app/utils/event-emitter';

interface MockHCS10Service {
  initialize: jest.Mock;
  findAgentsByCapability: jest.Mock;
  getKnownAgents: jest.Mock;
  sendRequest: jest.Mock;
  sendResponse: jest.Mock;
  registerAgent: jest.Mock;
  shutdown: jest.Mock;
}

// Mock EventBus
const mockEventBus = {
  onEvent: jest.fn(),
  emitEvent: jest.fn().mockReturnValue(true),
  getInstance: jest.fn().mockReturnThis(),
  enableLogging: jest.fn()
};

// Mock Hedera Service
const mockHederaService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
  subscribeToTopic: jest.fn().mockResolvedValue({ success: true }),
  sendMessage: jest.fn().mockResolvedValue({
    transactionId: 'mock-tx-id',
    success: true
  }),
  publishMessage: jest.fn().mockResolvedValue({
    transactionId: 'mock-tx-id',
    success: true
  }),
  createTopic: jest.fn().mockResolvedValue('0.0.12345')
};

// Create mock implementations
const mockHCS10Service: MockHCS10Service = {
  initialize: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
  findAgentsByCapability: jest.fn().mockReturnValue(['agent1']),
  getKnownAgents: jest.fn().mockReturnValue(new Map([
    ['agent1', {
      agentId: 'agent1',
      topicId: 'agent1-topic',
      capabilities: ['rebalancing'],
      status: 'active',
      lastSeen: Date.now()
    }]
  ])),
  sendRequest: jest.fn().mockResolvedValue({ requestId: 'mock-request-id' }),
  sendResponse: jest.fn().mockResolvedValue({ requestId: 'mock-request-id', recipientId: 'mock-agent' }),
  registerAgent: jest.fn().mockResolvedValue(true)
};

// Mock TokenizedIndexService
const mockIndexService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
  getTokenPrices: jest.fn().mockReturnValue({
    'BTC': 50000,
    'ETH': 3000
  }),
  processRebalanceProposal: jest.fn().mockResolvedValue(true)
};

// Mock config for testing
const testConfig = {
  agentId: 'test-agent',
  hederaConfig: {
    network: 'testnet',
    operatorId: '0.0.1234',
    operatorKey: '302e...'
  },
  hcs10Config: {
    registryTopicId: 'test-registry',
    agentTopicId: 'test-agent-topic',
    capabilities: ['price-feed', 'rebalancing'],
    description: 'Test Agent'
  },
  indexConfig: {
    indexTopicId: 'test-index-topic',
    tokenIds: {
      'BTC': '0.0.2001',
      'ETH': '0.0.2002'
    },
    initialWeights: {
      'BTC': 0.6,
      'ETH': 0.4
    }
  },
  eventLogging: true
};

// Mock dependencies
jest.mock('../../app/utils/event-emitter', () => ({
  EventBus: {
    getInstance: jest.fn().mockReturnValue(mockEventBus)
  },
  EventType: {
    SYSTEM_INITIALIZED: 'system:initialized',
    SYSTEM_ERROR: 'system:error',
    SYSTEM_SHUTDOWN: 'system:shutdown',
    MESSAGE_RECEIVED: 'message:received',
    HCS10_REQUEST_RECEIVED: 'hcs10:request:received',
    HCS10_RESPONSE_SENT: 'hcs10:response:sent',
    HCS10_AGENT_REGISTERED: 'hcs10:agent:registered',
    INDEX_PRICE_UPDATED: 'index:price:updated',
    INDEX_REBALANCE_PROPOSED: 'index:rebalance:proposed',
    INDEX_REBALANCE_APPROVED: 'index:rebalance:approved',
    INDEX_REBALANCE_EXECUTED: 'index:rebalance:executed',
    INDEX_RISK_ALERT: 'index:risk:alert',
    GOVERNANCE_PROPOSAL_CREATED: 'governance:proposal:created',
    GOVERNANCE_PROPOSAL_APPROVED: 'governance:proposal:approved',
  }
}));

jest.mock('../../app/services/shared-hedera-service', () => ({
  SharedHederaService: jest.fn().mockImplementation(() => mockHederaService)
}));

jest.mock('../../app/services/hcs10-protocol', () => ({
  HCS10ProtocolService: jest.fn().mockImplementation(() => mockHCS10Service)
}));

jest.mock('../../app/services/tokenized-index', () => ({
  TokenizedIndexService: jest.fn().mockImplementation(() => mockIndexService)
}));

describe('LynxifyAgent', () => {
  let agent: LynxifyAgent;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new agent instance for each test
    agent = new LynxifyAgent(testConfig);
  });

  describe('Agent Construction', () => {
    test('should create agent instance with provided config', () => {
      expect(agent).toBeDefined();
      expect(agent.getConfig()).toEqual(testConfig);
    });

    test('should enable event logging if configured', () => {
      expect(mockEventBus.enableLogging).toHaveBeenCalled();
    });

    test('should set up necessary event handlers during construction', () => {
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        EventType.HCS10_REQUEST_RECEIVED,
        expect.any(Function)
      );
      
      expect(mockEventBus.onEvent).toHaveBeenCalledWith(
        EventType.INDEX_REBALANCE_PROPOSED,
        expect.any(Function)
      );
    });
  });
  
  describe('Agent Initialization', () => {
    test('should initialize all service components', async () => {
      await agent.initialize();
      
      // Services should be initialized
      expect(mockHederaService.initialize).toHaveBeenCalled();
      expect(mockHCS10Service.initialize).toHaveBeenCalled();
      expect(mockIndexService.initialize).toHaveBeenCalled();
      
      // Check topic subscriptions
      expect(mockHederaService.subscribeToTopic).toHaveBeenCalledWith(
        testConfig.hcs10Config.registryTopicId,
        expect.any(Function)
      );
      expect(mockHederaService.subscribeToTopic).toHaveBeenCalledWith(
        testConfig.hcs10Config.agentTopicId,
        expect.any(Function)
      );
      expect(mockHederaService.subscribeToTopic).toHaveBeenCalledWith(
        testConfig.indexConfig.indexTopicId,
        expect.any(Function)
      );
      
      // System initialized event should be emitted
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_INITIALIZED,
        expect.anything()
      );
    });

    test('should handle initialization errors from Hedera service', async () => {
      mockHederaService.initialize.mockRejectedValueOnce(
        new Error('Hedera service initialization error')
      );
      
      await expect(agent.initialize()).rejects.toThrow('Hedera service initialization error');
      
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_ERROR,
        expect.any(Error)
      );
    });

    test('should handle initialization errors from HCS10 service', async () => {
      mockHCS10Service.initialize.mockRejectedValueOnce(
        new Error('HCS10 service initialization error')
      );
      
      await expect(agent.initialize()).rejects.toThrow('HCS10 service initialization error');
      
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_ERROR,
        expect.any(Error)
      );
    });

    test('should handle initialization errors from Index service', async () => {
      mockIndexService.initialize.mockRejectedValueOnce(
        new Error('Index service initialization error')
      );
      
      await expect(agent.initialize()).rejects.toThrow('Index service initialization error');
      
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_ERROR,
        expect.any(Error)
      );
    });

    test('should handle topic subscription errors', async () => {
      mockHederaService.subscribeToTopic.mockRejectedValueOnce(
        new Error('Topic subscription error')
      );
      
      await expect(agent.initialize()).rejects.toThrow('Topic subscription error');
      
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_ERROR,
        expect.any(Error)
      );
    });
  });
  
  describe('Agent Shutdown', () => {
    test('should shut down all service components', async () => {
      // First initialize the agent
      await agent.initialize();
      
      // Reset mocks after initialization
      jest.clearAllMocks();
      
      // Execute shutdown
      await agent.shutdown();
      
      // Verify services are shut down in correct order
      expect(mockIndexService.shutdown).toHaveBeenCalled();
      expect(mockHCS10Service.shutdown).toHaveBeenCalled();
      expect(mockHederaService.shutdown).toHaveBeenCalled();
      
      // System shutdown event should be emitted
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_SHUTDOWN,
        undefined
      );
    });

    test('should handle shutdown errors gracefully', async () => {
      // First initialize
      await agent.initialize();
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Make shutdown throw an error
      mockHederaService.shutdown.mockRejectedValueOnce(
        new Error('Shutdown error')
      );
      
      // Shutdown should complete without throwing
      await agent.shutdown();
      
      // Error should be emitted
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        EventType.SYSTEM_ERROR,
        expect.any(Error)
      );
    });
  });
  
  describe('Agent API and Getters', () => {
    test('should return the agent configuration', () => {
      expect(agent.getConfig()).toEqual(testConfig);
    });

    test('should return service instances', () => {
      expect(agent.getHederaService()).toBeDefined();
      expect(agent.getHCS10Service()).toBeDefined();
      expect(agent.getIndexService()).toBeDefined();
    });

    test('should track initialization status correctly', () => {
      expect(agent.isInitialized()).toBe(false);
      
      // Initialize and check again
      return agent.initialize().then(() => {
        expect(agent.isInitialized()).toBe(true);
        
        // Shutdown and check
        return agent.shutdown().then(() => {
          expect(agent.isInitialized()).toBe(false);
        });
      });
    });
  });
}); 