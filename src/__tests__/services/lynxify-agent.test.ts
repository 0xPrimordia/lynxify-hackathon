import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { EventBus, EventType } from '../../app/utils/event-emitter';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { HCS10ProtocolService } from '../../app/services/hcs10-protocol';
import { TokenizedIndexService } from '../../app/services/tokenized-index';
import { jest } from '@jest/globals';
import { disableAgentTimers } from '../utils/test-helpers';

// Mock the SharedHederaService entirely to prevent real SDK initialization
jest.mock('../../app/services/shared-hedera-service', () => {
  return {
    SharedHederaService: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      subscribeToTopic: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      createTopic: jest.fn().mockResolvedValue('0.0.12345')
    }))
  };
});

// Mock EventBus
jest.mock('../../app/utils/event-emitter', () => {
  const mockEventBus = {
    onEvent: jest.fn(),
    emitEvent: jest.fn().mockReturnValue(true),
    enableLogging: jest.fn()
  };
  
  return {
    EventBus: {
      getInstance: jest.fn().mockReturnValue(mockEventBus)
    },
    EventType: {
      SYSTEM_INITIALIZED: 'system:initialized',
      SYSTEM_ERROR: 'system:error',
      SYSTEM_SHUTDOWN: 'system:shutdown',
      MESSAGE_RECEIVED: 'message:received',
      HCS10_REQUEST_RECEIVED: 'hcs10:request:received',
      HCS10_RESPONSE_SENT: 'hcs10:response:sent'
      // Add other event types as needed
    }
  };
});

// Define interface for MockHCS10Service
interface MockHCS10Service {
  initialize: jest.Mock;
  findAgentsByCapability: jest.Mock;
  getKnownAgents: jest.Mock;
  sendRequest: jest.Mock;
  sendResponse: jest.Mock;
  registerAgent: jest.Mock;
  shutdown: jest.Mock;
}

// Create the mock HCS10Service
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
  registerAgent: jest.fn().mockResolvedValue(undefined)
};

// Mock HCS10 service
jest.mock('../../app/services/hcs10-protocol', () => {
  return {
    HCS10ProtocolService: jest.fn().mockImplementation(() => mockHCS10Service)
  };
});

// Create the mock for the IndexService
const mockIndexService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
  getCurrentWeights: jest.fn().mockReturnValue({ 'token1': 0.7, 'token2': 0.3 }),
  getTokenPrices: jest.fn().mockReturnValue({
    'token1': { price: 100, timestamp: Date.now(), source: 'test' },
    'token2': { price: 200, timestamp: Date.now(), source: 'test' }
  })
};

// Mock TokenizedIndexService
jest.mock('../../app/services/tokenized-index', () => {
  return {
    TokenizedIndexService: jest.fn().mockImplementation(() => mockIndexService)
  };
});

describe('LynxifyAgent', () => {
  let agent: LynxifyAgent;
  let mockEventBus: any;
  
  beforeEach(() => {
    // Set up fake timers to prevent real timers from running
    jest.useFakeTimers();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mock EventBus instance
    mockEventBus = EventBus.getInstance();
    
    // Create agent instance with test config using valid values for test
    agent = new LynxifyAgent({
      agentId: 'test-agent',
      hederaConfig: {
        network: 'testnet',
        operatorId: '0.0.12345',  // Valid format for tests
        operatorKey: '302e020100300506032b657004220420123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234'
      },
      hcs10Config: {
        registryTopicId: 'test-registry',
        agentTopicId: 'test-agent-topic',
        capabilities: ['rebalancing', 'price-feed'],
        description: 'Test Agent'
      },
      indexConfig: {
        indexTopicId: 'test-index-topic',
        proposalTimeoutMs: 1000,
        rebalanceThreshold: 0.1,
        riskThreshold: 0.2
      },
      logEvents: true
    });
  });
  
  afterEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear all timers and return to real timers
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Explicitly disable all timers first
    if (agent) {
      await disableAgentTimers(agent);
      // Then shut down the agent
      await agent.shutdown();
    }
  });
  
  // Basic test to ensure agent can be created
  test('should be created with configuration', () => {
    expect(agent).toBeDefined();
    expect(agent.getConfig().agentId).toBe('test-agent');
  });
  
  // Test initialization
  test('should initialize services properly', async () => {
    await agent.initialize();
    
    // Check that services were initialized
    expect(SharedHederaService).toHaveBeenCalled();
    expect(HCS10ProtocolService).toHaveBeenCalled();
    expect(TokenizedIndexService).toHaveBeenCalled();
    
    // Check that mocked services were initialized
    const hederaService = agent.getHederaService();
    expect(hederaService.initialize).toHaveBeenCalled();
    
    // Check that the agent emitted initialized event
    expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
      EventType.SYSTEM_INITIALIZED,
      expect.any(Object)
    );
  });
}); 