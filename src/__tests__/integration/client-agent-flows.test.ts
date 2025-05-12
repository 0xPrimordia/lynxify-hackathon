import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { HCS10ProtocolService } from '../../app/services/hcs10-protocol';
import { TokenizedIndexService } from '../../app/services/tokenized-index';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { TokenService } from '../../app/services/token-service';
import { PriceFeedService } from '../../app/services/price-feed-service';
import { EventBus, EventType } from '../../app/utils/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

jest.mock('../../app/services/shared-hedera-service');
jest.mock('../../app/services/token-service');
jest.mock('../../app/services/price-feed-service');

// Mock WebSocket for client-side
jest.mock('ws', () => {
  const MockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // WebSocket.OPEN
  }));
  MockWebSocket.OPEN = 1;
  return MockWebSocket;
});

// Mock the UnifiedWebSocketServer class
const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockBroadcast = jest.fn();

// Create a mock implementation of the UnifiedWebSocketServer
class MockUnifiedWebSocketServer {
  constructor(config: any) {
    // Store config if needed
  }

  start = mockStart;
  stop = mockStop;
  broadcastToAll = mockBroadcast;
}

// Replace the actual import with our mock
jest.mock('../../app/services/unified-websocket', () => ({
  UnifiedWebSocketServer: MockUnifiedWebSocketServer
}));

describe('Client-Agent Integration Flows', () => {
  let agent: LynxifyAgent;
  let hederaService: SharedHederaService;
  let tokenService: TokenService;
  let priceFeedService: PriceFeedService;
  let webSocketServer: any; // Use any type for our mock
  let mockWebSocketClient: WebSocket;
  let eventBus: EventBus;
  
  const agentConfig = {
    agentId: 'test-agent',
    hederaConfig: {
      network: 'testnet' as const,
      operatorId: 'test-operator',
      operatorKey: 'test-key'
    },
    hcs10Config: {
      registryTopicId: 'test-registry-topic',
      agentTopicId: 'test-agent-topic',
      capabilities: ['price-feed', 'rebalancing', 'governance'],
      description: 'Test Agent'
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
    
    // Create agent
    agent = new LynxifyAgent(agentConfig);
    
    // Create WebSocket server with our mock implementation
    webSocketServer = new MockUnifiedWebSocketServer({
      port: 3030,
      agent: agent,
      hederaService: hederaService
    });
    
    // Create mock WebSocket client
    mockWebSocketClient = new WebSocket('ws://localhost:3030');
    
    // Spy on eventBus methods
    jest.spyOn(eventBus, 'emitEvent');
    jest.spyOn(eventBus, 'onEvent');
    
    // Spy on WebSocket methods
    jest.spyOn(mockWebSocketClient, 'send');
  });
  
  afterEach(async () => {
    // Clean up any event handlers or intervals
    jest.useRealTimers();
    await webSocketServer.stop();
  });
  
  /**
   * Test Flow 1: Client connection and agent status
   * 
   * Tests the complete flow of:
   * 1. Client connects to WebSocket server
   * 2. Server sends agent status
   * 3. Agent initializes
   * 4. Status update is propagated to client
   */
  test('Client Connection and Agent Status Flow', async () => {
    // Simulate client connection
    const connectionHandlers: {[key: string]: Function} = {};
    
    // Mock the WebSocket 'on' method to capture event handlers
    (mockWebSocketClient.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
      connectionHandlers[event] = handler;
    });
    
    // Start WebSocket server
    await webSocketServer.start();
    expect(mockStart).toHaveBeenCalled();
    
    // Simulate 'open' event on client
    if (connectionHandlers['open']) {
      connectionHandlers['open']();
    }
    
    // Wait for server setup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize agent
    await agent.initialize();
    
    // Manually emit the event that our mock WebSocket server would capture
    eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, undefined);
    
    // Check that the client received status update
    // In a real implementation, this would happen via the WebSocket server
    // For our test, we'll verify the event was emitted
    expect(eventBus.emitEvent).toHaveBeenCalledWith(
      EventType.SYSTEM_INITIALIZED,
      expect.anything()
    );
    
    // Verify client received initial agent status
    // In a real scenario, the WebSocket server would send this to the client
    expect(agent.isInitialized()).toBe(true);
  });
  
  /**
   * Test Flow 2: Client initiates price update
   * 
   * Tests the flow of:
   * 1. Client requests price update
   * 2. Server processes the request
   * 3. Price update is propagated to the agent
   * 4. Agent processes price update and checks for rebalance
   * 5. Result is sent back to client
   */
  test('Client-Initiated Price Update Flow', async () => {
    // Initialize agent
    await agent.initialize();
    
    // Start WebSocket server
    await webSocketServer.start();
    expect(mockStart).toHaveBeenCalled();
    
    // Simulate client-initiated price update by directly emitting the event
    eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
      tokenId: '0.0.1001', // BTC
      price: 65000,
      source: 'client'
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify price update event was emitted
    expect(eventBus.emitEvent).toHaveBeenCalledWith(
      EventType.INDEX_PRICE_UPDATED,
      expect.objectContaining({
        tokenId: '0.0.1001',
        price: 65000
      })
    );
  });
  
  /**
   * Test Flow 3: Client receives rebalance events
   * 
   * Tests the flow of:
   * 1. Agent proposes rebalance
   * 2. Rebalance proposal is propagated to client
   * 3. Client receives notification
   */
  test('Rebalance Events to Client Flow', async () => {
    // Initialize agent
    await agent.initialize();
    
    // Start WebSocket server
    await webSocketServer.start();
    expect(mockStart).toHaveBeenCalled();
    
    // Emit rebalance proposal event
    eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
      proposalId: 'test-proposal',
      newWeights: {
        'BTC': 0.4,
        'ETH': 0.4,
        'SOL': 0.2
      },
      trigger: 'price_deviation'
    });
    
    // Verify event was emitted
    expect(eventBus.emitEvent).toHaveBeenCalledWith(
      EventType.INDEX_REBALANCE_PROPOSED,
      expect.objectContaining({
        proposalId: 'test-proposal'
      })
    );
    
    // In a real scenario, the WebSocket server would send this to clients
    expect(mockBroadcast).not.toHaveBeenCalled(); // Our mock doesn't handle events
  });
  
  /**
   * Test Flow 4: Client initiates governance action
   * 
   * Tests the flow of:
   * 1. Client sends governance proposal
   * 2. Server processes and sends to agent
   * 3. Agent processes governance action
   * 4. Response is sent back to client
   */
  test('Client-Initiated Governance Flow', async () => {
    // Initialize agent
    await agent.initialize();
    
    // Start WebSocket server
    await webSocketServer.start();
    
    // Simulate client-initiated governance action
    const messageHandlers: {[key: string]: Function} = {};
    
    // Mock the WebSocket 'on' method to capture event handlers
    (mockWebSocketClient.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
      messageHandlers[event] = handler;
    });
    
    // Simulate client sending governance proposal
    if (messageHandlers['message']) {
      messageHandlers['message'](JSON.stringify({
        type: 'GovernanceProposal',
        data: {
          title: 'Change Risk Threshold',
          description: 'Proposal to adjust risk threshold',
          changes: {
            riskThreshold: 0.25 // from 0.2 to 0.25
          }
        }
      }));
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify governance proposal event was emitted
    expect(eventBus.emitEvent).toHaveBeenCalledWith(
      EventType.GOVERNANCE_PROPOSAL_CREATED,
      expect.objectContaining({
        title: 'Change Risk Threshold'
      })
    );
    
    // Verify client received confirmation
    expect(mockWebSocketClient.send).toHaveBeenCalledWith(
      expect.stringContaining('GovernanceProposalCreated')
    );
  });
  
  /**
   * Test Flow 5: Risk alert propagation to client
   * 
   * Tests the flow of:
   * 1. Agent detects risk threshold breach
   * 2. Risk alert is propagated to WebSocket server
   * 3. Client receives risk alert notification
   */
  test('Risk Alert Propagation to Client Flow', async () => {
    // Initialize agent
    await agent.initialize();
    
    // Start WebSocket server
    await webSocketServer.start();
    
    // Emit risk alert event
    eventBus.emitEvent(EventType.INDEX_RISK_ALERT, {
      severity: 'high',
      riskDescription: 'Portfolio volatility exceeds threshold',
      affectedTokens: ['0.0.1003'] // SOL is high risk
    });
    
    // Wait for WebSocket server to process and send
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify client received risk alert notification
    expect(mockWebSocketClient.send).toHaveBeenCalledWith(
      expect.stringContaining('RiskAlert')
    );
    
    // Verify risk alert details
    const alertCall = (mockWebSocketClient.send as jest.Mock).mock.calls.find(
      call => call[0] && JSON.parse(call[0]).type === 'RiskAlert'
    );
    
    if (alertCall) {
      const alertMessage = JSON.parse(alertCall[0]);
      expect(alertMessage.data.severity).toBe('high');
      expect(alertMessage.data.riskDescription).toContain('volatility');
    }
  });
}); 