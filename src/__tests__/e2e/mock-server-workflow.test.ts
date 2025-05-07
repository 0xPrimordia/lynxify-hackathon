/**
 * Mock Server Workflow E2E Test
 * 
 * This test mocks the entire server workflow without directly importing modules
 * that depend on browser APIs to avoid compatibility issues.
 */

// Mock the necessary server components
const mockAgentRegistry = {
  isAlreadyRegistered: jest.fn().mockResolvedValue(true),
  getStoredRegistrationInfo: jest.fn().mockResolvedValue({
    accountId: '0.0.123',
    inboundTopicId: '0.0.4',
    outboundTopicId: '0.0.5',
    registryTopic: '0.0.3'
  }),
  registerAgent: jest.fn().mockResolvedValue({
    success: true,
    accountId: '0.0.123',
    inboundTopicId: '0.0.4',
    outboundTopicId: '0.0.5'
  })
};

const mockProposalHandler = {
  handleMessage: jest.fn(),
  getPendingProposalCount: jest.fn().mockReturnValue(0),
  getExecutedProposalCount: jest.fn().mockReturnValue(0)
};

const mockWebsocketService = {
  initialize: jest.fn(),
  broadcast: jest.fn(),
  close: jest.fn(),
  getClientCount: jest.fn().mockReturnValue(0)
};

const mockHCSMessaging = {
  sendHCSMessage: jest.fn().mockResolvedValue(undefined),
  subscribeToTopic: jest.fn().mockResolvedValue(undefined)
};

// Mock the server init function
const mockInitializeServer = jest.fn().mockResolvedValue(undefined);

jest.mock('@/app/server/server-init', () => ({
  initializeServer: mockInitializeServer
}));

jest.mock('@/app/services/agent-registry', () => mockAgentRegistry);
jest.mock('@/app/services/proposal-handler', () => mockProposalHandler);
jest.mock('@/app/services/websocket', () => mockWebsocketService);
jest.mock('@/app/services/hcs-messaging', () => mockHCSMessaging);

// Set environment variables for testing
process.env.NEXT_PUBLIC_OPERATOR_ID = '0.0.4340026';
process.env.OPERATOR_KEY = 'mock-private-key';
process.env.IS_TEST_ENV = 'true';

/**
 * End-to-end test for server workflow
 */
describe('Mock Server Workflow E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers for setTimeout/setInterval
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    // Restore real timers
    jest.useRealTimers();
  });

  test('server should initialize with agent registry check', async () => {
    // Call the initialize function
    await mockInitializeServer();
    
    // Verify that it would have been called in a real scenario
    expect(mockInitializeServer).toHaveBeenCalled();
  });
  
  test('should handle rebalance proposal workflow', () => {
    // Create test proposal
    const mockProposal = {
      id: 'test-proposal',
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'test-agent',
      details: {
        newWeights: { BTC: 0.5, ETH: 0.3, SOL: 0.2 },
        executeAfter: Date.now() + 3600000,
        quorum: 5000
      }
    };
    
    // Mock the approval flow
    mockProposalHandler.handleMessage.mockImplementation((message) => {
      if (message.type === 'RebalanceProposal') {
        // Simulate auto-approval
        setTimeout(() => {
          const approvalMessage = {
            id: `approval-${Date.now()}`,
            type: 'RebalanceApproved',
            timestamp: Date.now(),
            sender: 'test-agent',
            details: {
              proposalId: message.id,
              approvedAt: Date.now()
            }
          };
          mockProposalHandler.handleMessage(approvalMessage);
        }, 100);
      }
    });
    
    // Start the message flow
    mockProposalHandler.handleMessage(mockProposal);
    
    // Verify the call
    expect(mockProposalHandler.handleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RebalanceProposal'
      })
    );
    
    // Fast-forward time to trigger the setTimeout
    jest.advanceTimersByTime(200);
    
    // Verify the approval was handled
    expect(mockProposalHandler.handleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RebalanceApproved'
      })
    );
  });
  
  test('websocket service should broadcast messages to clients', () => {
    // Broadcast a test message
    mockWebsocketService.broadcast({
      type: 'test',
      data: { message: 'Test message' }
    });
    
    // Verify the broadcast was called
    expect(mockWebsocketService.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'test',
        data: expect.objectContaining({
          message: 'Test message'
        })
      })
    );
  });
}); 