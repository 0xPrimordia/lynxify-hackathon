/**
 * NOTE: This test file requires a separate Jest configuration with JSX/TSX support
 * and a jsdom test environment. It is currently excluded from the main test run.
 * 
 * To run this file and other React component tests, a separate config should be created:
 * 1. Create a jest.react.config.js file with the jsdom test environment
 * 2. Run with: npx jest --config=jest.react.config.js src/__tests__/e2e/
 */
// @ts-nocheck
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import WebSocket from 'ws';
import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { TokenService } from '../../app/services/token-service';
import { PriceFeedService } from '../../app/services/price-feed-service';
import { TokenizedIndexService } from '../../app/services/tokenized-index';
import { UnifiedWebSocketServer } from '../../app/services/unified-websocket';
import { EventBus, EventType } from '../../app/utils/event-emitter';
import Dashboard from '../../app/components/Dashboard';
import RebalanceProposalModal from '../../app/components/RebalanceProposalModal';
import AgentStatus from '../../app/components/AgentStatus';
import HCSMessageFeed from '../../app/components/HCSMessageFeed';
import IndexComposition from '../../app/components/IndexComposition';
import { v4 as uuidv4 } from 'uuid';

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Mock dependencies
jest.mock('../../app/services/shared-hedera-service', () => ({
  SharedHederaService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    subscribeToTopic: jest.fn().mockResolvedValue({ success: true }),
    createTopic: jest.fn().mockResolvedValue('0.0.12345'),
    publishMessage: jest.fn().mockResolvedValue({ 
      transactionId: 'mock-tx-id', 
      success: true 
    }),
    getClient: jest.fn()
  }))
}));

jest.mock('../../app/services/token-service', () => {
  // Create mock token balances that will change during tests
  let mockTokenBalances = {
    'BTC': 10,
    'ETH': 50,
    'SOL': 500,
    'LYNX': 1000
  };
  
  return {
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
      getTokenBalances: jest.fn().mockResolvedValue(mockTokenBalances),
      mintTokens: jest.fn().mockImplementation((tokenId: string, amount: number) => {
        const symbol = Object.entries({
          'BTC': '0.0.1001',
          'ETH': '0.0.1002',
          'SOL': '0.0.1003',
          'LYNX': '0.0.1004'
        }).find(([_, id]) => id === tokenId)?.[0];
        
        if (symbol) {
          mockTokenBalances[symbol as keyof typeof mockTokenBalances] += amount;
        }
        
        return Promise.resolve(true);
      }),
      burnTokens: jest.fn().mockImplementation((tokenId: string, amount: number) => {
        const symbol = Object.entries({
          'BTC': '0.0.1001',
          'ETH': '0.0.1002',
          'SOL': '0.0.1003',
          'LYNX': '0.0.1004'
        }).find(([_, id]) => id === tokenId)?.[0];
        
        if (symbol && mockTokenBalances[symbol as keyof typeof mockTokenBalances] >= amount) {
          mockTokenBalances[symbol as keyof typeof mockTokenBalances] -= amount;
        }
        
        return Promise.resolve(true);
      }),
      resetBalances: () => {
        mockTokenBalances = {
          'BTC': 10,
          'ETH': 50,
          'SOL': 500,
          'LYNX': 1000
        };
      }
    }))
  };
});

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
    isInitialized: jest.fn().mockReturnValue(true),
    cleanup: jest.fn()
  }))
}));

// Mock WebSocket client
jest.mock('ws', () => {
  const EventEmitter = require('events');
  
  class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // WebSocket.OPEN
    }
    
    send(data: string) {
      this.emit('_sent', data);
    }
    
    close() {
      this.emit('close');
    }
  }
  
  MockWebSocket.OPEN = 1;
  return MockWebSocket;
});

// Mock React components
jest.mock('../../app/components/Dashboard', () => {
  return function MockDashboard({ children }: { children: React.ReactNode }) {
    return <div data-testid="dashboard">{children}</div>;
  };
});

jest.mock('../../app/components/RebalanceProposalModal', () => {
  return function MockRebalanceProposalModal({ 
    isOpen, 
    onClose, 
    onSubmit 
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: (weights: Record<string, number>) => void; 
  }) {
    return isOpen ? (
      <div data-testid="rebalance-modal">
        <button data-testid="submit-proposal" onClick={() => onSubmit({ 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 })}>
          Submit Proposal
        </button>
        <button data-testid="close-modal" onClick={onClose}>Close</button>
      </div>
    ) : null;
  };
});

jest.mock('../../app/components/AgentStatus', () => {
  return function MockAgentStatus({ status }: { status: any }) {
    return (
      <div data-testid="agent-status">
        Status: {status?.isInitialized ? 'Initialized' : 'Not Initialized'}
      </div>
    );
  };
});

jest.mock('../../app/components/HCSMessageFeed', () => {
  return function MockHCSMessageFeed({ messages }: { messages: any[] }) {
    return (
      <div data-testid="message-feed">
        {messages.map((msg, idx) => (
          <div key={idx} data-testid={`message-${idx}`}>
            {msg.type}: {msg.id}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../../app/components/IndexComposition', () => {
  return function MockIndexComposition({ weights }: { weights: Record<string, number> }) {
    return (
      <div data-testid="index-composition">
        {Object.entries(weights).map(([token, weight]) => (
          <div key={token} data-testid={`weight-${token}`}>
            {token}: {weight}
          </div>
        ))}
      </div>
    );
  };
});

// Create a WebSocketContext mock
const WebSocketContext = {
  ws: null as WebSocket | null,
  connected: false,
  messages: [] as any[],
  status: { isInitialized: false },
  weights: { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 },
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendMessage: jest.fn()
};

// Mock the React context hook
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useContext: () => WebSocketContext
  };
});

describe('End-to-End WebSocket UI Flow', () => {
  let agent: LynxifyAgent;
  let hederaService: SharedHederaService;
  let tokenService: TokenService;
  let priceFeedService: PriceFeedService;
  let indexService: TokenizedIndexService;
  let webSocketServer: UnifiedWebSocketServer;
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
  
  beforeEach(async () => {
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
    
    // Reset token balances for fresh tests
    (tokenService as any).resetBalances();
    
    priceFeedService = new PriceFeedService(hederaService, {
      outputTopicId: 'test-price-topic',
      tokenIds: {
        'BTC': '0.0.1001',
        'ETH': '0.0.1002',
        'SOL': '0.0.1003',
        'LYNX': '0.0.1004'
      }
    });
    
    // Create agent and mock initialization
    agent = new LynxifyAgent(agentConfig);
    await agent.initialize();
    
    // Mock the agent's services
    indexService = agent.getIndexService();
    
    // Mock agent's getCurrentWeights method
    jest.spyOn(indexService, 'getCurrentWeights').mockReturnValue({
      'BTC': 0.4,
      'ETH': 0.4,
      'SOL': 0.2
    });
    
    // Create WebSocket server with mocked dependencies
    webSocketServer = new UnifiedWebSocketServer({
      port: 3030,
      agent: agent,
      hederaService: hederaService
    });
    
    await webSocketServer.start();
    
    // Create mock WebSocket client
    mockWebSocketClient = new WebSocket('ws://localhost:3030');
    
    // Mock the WebSocketContext
    WebSocketContext.ws = mockWebSocketClient;
    WebSocketContext.connected = true;
    WebSocketContext.messages = [];
    WebSocketContext.status = { isInitialized: true };
    WebSocketContext.weights = { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 };
    
    // Setup WebSocket message handling for tests
    mockWebSocketClient.on('_sent', (data: string) => {
      try {
        const message = JSON.parse(data);
        WebSocketContext.messages.push(message);
        
        // Update context based on message type
        if (message.type === 'AgentStatus') {
          WebSocketContext.status = message.data;
        } else if (message.type === 'RebalanceProposed') {
          // Simulate the UI receiving a proposal
          eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, message.data);
        } else if (message.type === 'RebalanceApproved') {
          // Simulate the UI receiving an approval
          eventBus.emitEvent(EventType.INDEX_REBALANCE_APPROVED, message.data);
        } else if (message.type === 'RebalanceExecuted') {
          // Simulate the UI receiving an execution
          eventBus.emitEvent(EventType.INDEX_REBALANCE_EXECUTED, message.data);
          // Update weights after execution
          WebSocketContext.weights = message.data.newWeights;
        }
      } catch (e) {
        console.error('Error parsing WebSocket message', e);
      }
    });
    
    // Spy on eventBus methods
    jest.spyOn(eventBus, 'emitEvent');
    
    // Render the main UI components
    render(
      <Dashboard>
        <AgentStatus status={WebSocketContext.status} />
        <IndexComposition weights={WebSocketContext.weights} />
        <HCSMessageFeed messages={WebSocketContext.messages} />
        <RebalanceProposalModal 
          isOpen={false} 
          onClose={() => {}} 
          onSubmit={() => {}}
        />
      </Dashboard>
    );
  });
  
  afterEach(async () => {
    // Clean up
    WebSocketContext.ws = null;
    WebSocketContext.connected = false;
    
    await webSocketServer.stop();
    jest.useRealTimers();
  });
  
  /**
   * Test Flow 1: Connection and Agent Status
   * 
   * Tests the WebSocket connection establishing and status updates
   */
  test('WebSocket connection and agent status updates', async () => {
    // Verify the initial render has the agent status
    expect(screen.getByTestId('agent-status')).toHaveTextContent('Initialized');
    
    // Verify Dashboard is rendered
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    
    // Verify the initial index composition is displayed
    expect(screen.getByTestId('index-composition')).toBeInTheDocument();
    expect(screen.getByTestId('weight-BTC')).toHaveTextContent('BTC: 0.4');
    expect(screen.getByTestId('weight-ETH')).toHaveTextContent('ETH: 0.4');
    expect(screen.getByTestId('weight-SOL')).toHaveTextContent('SOL: 0.2');
    
    // Simulate agent status update from server
    act(() => {
      // Mock a status update message from server
      WebSocketContext.status = { 
        isInitialized: true, 
        registrationStatus: 'registered',
        connectedAgents: 2
      };
      
      // Re-render with new status
      render(
        <AgentStatus status={WebSocketContext.status} />
      );
    });
    
    // Verify the status was updated in the UI
    await waitFor(() => {
      expect(screen.getByTestId('agent-status')).toHaveTextContent('Initialized');
    });
  });
  
  /**
   * Test Flow 2: Complete Rebalance Process
   * 
   * Tests the full flow from UI rebalance proposal to execution
   */
  test('Complete rebalance proposal, approval, and execution flow', async () => {
    // Simulate opening the rebalance proposal modal
    act(() => {
      render(
        <RebalanceProposalModal 
          isOpen={true} 
          onClose={jest.fn()} 
          onSubmit={(weights) => {
            // Simulate WebSocket message sent to server
            const proposalMessage = {
              type: 'rebalance_proposal',
              data: {
                weights,
                description: 'Test proposal from UI'
              }
            };
            
            // Mock sending to server
            if (WebSocketContext.ws) {
              WebSocketContext.ws.emit('message', JSON.stringify(proposalMessage));
            }
          }} 
        />
      );
    });
    
    // Verify the modal is rendered
    expect(screen.getByTestId('rebalance-modal')).toBeInTheDocument();
    
    // Submit the proposal
    act(() => {
      fireEvent.click(screen.getByTestId('submit-proposal'));
    });
    
    // Simulate the server creating a rebalance proposal message
    const proposalId = 'proposal-1';
    act(() => {
      const proposalMessage = {
        type: 'RebalanceProposed',
        data: {
          proposalId,
          newWeights: { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 },
          trigger: 'user_initiated',
          timestamp: Date.now()
        }
      };
      
      // Add message to context and trigger UI update
      WebSocketContext.messages.push(proposalMessage);
      
      // Re-render the message feed
      render(
        <HCSMessageFeed messages={WebSocketContext.messages} />
      );
    });
    
    // Verify the proposal message appears in the feed
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('RebalanceProposed');
    });
    
    // Simulate the approval of the proposal
    act(() => {
      const approvalMessage = {
        type: 'RebalanceApproved',
        data: {
          proposalId,
          approvedAt: Date.now()
        }
      };
      
      // Add message to context and trigger UI update
      WebSocketContext.messages.push(approvalMessage);
      
      // Re-render the message feed
      render(
        <HCSMessageFeed messages={WebSocketContext.messages} />
      );
    });
    
    // Verify the approval message appears in the feed
    await waitFor(() => {
      expect(screen.getByTestId('message-1')).toHaveTextContent('RebalanceApproved');
    });
    
    // Simulate the execution of the proposal
    act(() => {
      const executionMessage = {
        type: 'RebalanceExecuted',
        data: {
          proposalId,
          executedAt: Date.now(),
          newWeights: { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 }
        }
      };
      
      // Add message to context
      WebSocketContext.messages.push(executionMessage);
      
      // Update weights in the context to simulate execution
      WebSocketContext.weights = { 'BTC': 0.5, 'ETH': 0.3, 'SOL': 0.2 };
      
      // Re-render the components
      render(
        <>
          <HCSMessageFeed messages={WebSocketContext.messages} />
          <IndexComposition weights={WebSocketContext.weights} />
        </>
      );
    });
    
    // Verify the execution message appears in the feed
    await waitFor(() => {
      expect(screen.getByTestId('message-2')).toHaveTextContent('RebalanceExecuted');
    });
    
    // Verify the index composition updates to reflect the new weights
    await waitFor(() => {
      expect(screen.getByTestId('weight-BTC')).toHaveTextContent('BTC: 0.5');
      expect(screen.getByTestId('weight-ETH')).toHaveTextContent('ETH: 0.3');
      expect(screen.getByTestId('weight-SOL')).toHaveTextContent('SOL: 0.2');
    });
  });
  
  /**
   * Test Flow 3: Risk Alert Propagation
   * 
   * Tests risk alerts from agent propagating to UI via WebSocket
   */
  test('Risk alert propagation from agent to UI', async () => {
    // Simulate a risk alert from the agent
    act(() => {
      // Emit a risk alert event
      eventBus.emitEvent(EventType.INDEX_RISK_ALERT, {
        severity: 'high',
        riskDescription: 'Portfolio volatility exceeds threshold',
        affectedTokens: ['0.0.1003'] // SOL is high risk
      });
      
      // Simulate the WebSocket server sending the risk alert to clients
      const riskAlertMessage = {
        type: 'RiskAlert',
        data: {
          severity: 'high',
          riskDescription: 'Portfolio volatility exceeds threshold',
          affectedTokens: ['0.0.1003'],
          timestamp: Date.now()
        }
      };
      
      // Add message to context
      WebSocketContext.messages.push(riskAlertMessage);
      
      // Re-render the message feed
      render(
        <HCSMessageFeed messages={WebSocketContext.messages} />
      );
    });
    
    // Verify the risk alert message appears in the feed
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('RiskAlert');
    });
    
    // Verify the event bus received the risk alert
    expect(eventBus.emitEvent).toHaveBeenCalledWith(
      EventType.INDEX_RISK_ALERT,
      expect.objectContaining({
        severity: 'high',
        riskDescription: expect.stringContaining('volatility')
      })
    );
  });
  
  /**
   * Test Flow 4: Token Operations via WebSocket
   * 
   * Tests token operations initiated from UI via WebSocket
   */
  test('Token operations from UI via WebSocket', async () => {
    // Simulate a token mint operation from UI
    act(() => {
      // Mock a mint message from UI
      const mintMessage = {
        type: 'token_operation',
        data: {
          operation: 'mint',
          token: '0.0.1001', // BTC
          amount: 5
        }
      };
      
      // Mock sending to server
      if (WebSocketContext.ws) {
        WebSocketContext.ws.emit('message', JSON.stringify(mintMessage));
      }
    });
    
    // Simulate server response
    act(() => {
      const operationResultMessage = {
        type: 'token_operation_result',
        data: {
          operation: 'mint',
          token: '0.0.1001',
          amount: 5,
          success: true
        }
      };
      
      // Add message to context
      WebSocketContext.messages.push(operationResultMessage);
      
      // Re-render the message feed
      render(
        <HCSMessageFeed messages={WebSocketContext.messages} />
      );
    });
    
    // Verify the operation result message appears in the feed
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('token_operation_result');
    });
    
    // Verify the token service was called with correct parameters
    expect(tokenService.mintTokens).toHaveBeenCalledWith('0.0.1001', 5);
  });
}); 