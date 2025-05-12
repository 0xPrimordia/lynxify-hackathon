// Mock the dependencies
jest.mock('@/app/utils/event-emitter', () => {
  const mockEmitEvent = jest.fn().mockReturnValue(true);
  const mockOnEvent = jest.fn();
  const mockEnableLogging = jest.fn();
  
  return {
    EventType: {
      SYSTEM_ERROR: 'system:error',
      SYSTEM_INITIALIZED: 'system:initialized',
      SYSTEM_SHUTDOWN: 'system:shutdown',
      HCS10_REQUEST_RECEIVED: 'hcs10:request:received',
      INDEX_REBALANCE_PROPOSED: 'index:rebalance:proposed',
    },
    EventBus: {
      getInstance: jest.fn().mockReturnValue({
        onEvent: mockOnEvent,
        emitEvent: mockEmitEvent,
        enableLogging: mockEnableLogging
      })
    }
  };
});

// Mock SharedHederaService
jest.mock('@/app/services/shared-hedera-service', () => ({
  SharedHederaService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    subscribeToTopic: jest.fn().mockResolvedValue({ success: true }),
  }))
}));

// Mock HCS10ProtocolService
jest.mock('@/app/services/hcs10-protocol', () => ({
  HCS10ProtocolService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  }))
}));

// Mock TokenizedIndexService
jest.mock('@/app/services/tokenized-index', () => ({
  TokenizedIndexService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  }))
}));

// Import modules after mocks
const { LynxifyAgent } = require('@/app/services/lynxify-agent');
const { EventBus, EventType } = require('@/app/utils/event-emitter');
const { SharedHederaService } = require('@/app/services/shared-hedera-service');

describe('LynxifyAgent', () => {
  let agent;
  let mockConfig;
  let mockEventBus;
  let mockSharedHederaInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked EventBus
    mockEventBus = EventBus.getInstance();
    
    // Setup test config
    mockConfig = {
      agentId: 'test-agent',
      hederaConfig: {
        network: 'testnet',
        operatorId: 'test-operator',
        operatorKey: 'test-key'
      },
      hcs10Config: {
        registryTopicId: 'test-registry',
        agentTopicId: 'test-agent-topic',
        capabilities: ['test-capability'],
        description: 'Test Agent'
      },
      indexConfig: {
        indexTopicId: 'test-index-topic',
        proposalTimeoutMs: 1000,
        rebalanceThreshold: 0.1,
        riskThreshold: 0.2
      },
      logEvents: true
    };
    
    // Create agent instance
    agent = new LynxifyAgent(mockConfig);
    
    // Get shared Hedera service
    mockSharedHederaInstance = SharedHederaService.mock.results[0].value;
  });
  
  it('should create an instance', () => {
    expect(agent).toBeDefined();
  });
  
  it('should enable event logging if configured', () => {
    expect(mockEventBus.enableLogging).toHaveBeenCalled();
  });
  
  it('should setup event handlers', () => {
    expect(mockEventBus.onEvent).toHaveBeenCalledWith(
      EventType.SYSTEM_ERROR,
      expect.any(Function)
    );
    
    expect(mockEventBus.onEvent).toHaveBeenCalledWith(
      EventType.HCS10_REQUEST_RECEIVED,
      expect.any(Function)
    );
  });
  
  it('should initialize properly', async () => {
    await agent.initialize();
    
    expect(mockSharedHederaInstance.initialize).toHaveBeenCalled();
    expect(mockSharedHederaInstance.subscribeToTopic).toHaveBeenCalled();
    expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
      EventType.SYSTEM_INITIALIZED,
      undefined
    );
  });
  
  it('should shutdown properly', async () => {
    await agent.shutdown();
    
    expect(mockSharedHederaInstance.shutdown).toHaveBeenCalled();
    expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
      EventType.SYSTEM_SHUTDOWN,
      undefined
    );
  });
}); 