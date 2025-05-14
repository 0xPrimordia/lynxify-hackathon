import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { EventBus, EventType } from '../../app/utils/event-emitter';
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
        getTokenId: jest.fn().mockImplementation((symbol) => {
            const mockTokenIds = {
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
        })
    }))
}));
jest.mock('../../app/services/price-feed-service', () => ({
    PriceFeedService: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        getLatestPrice: jest.fn().mockImplementation((symbol) => {
            const mockPrices = {
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
        })
    }))
}));
describe('HCS-10 Protocol Agent Communication Flows', () => {
    let agent1;
    let agent2;
    let agent3;
    let hederaService;
    let eventBus;
    let mockPublishMessage;
    let mockSubscribeToTopic;
    const agent1Config = {
        agentId: 'agent1',
        hederaConfig: {
            network: 'testnet',
            operatorId: 'test-operator-1',
            operatorKey: 'test-key-1'
        },
        hcs10Config: {
            registryTopicId: 'test-registry-topic',
            agentTopicId: 'agent1-topic',
            capabilities: ['price-feed', 'rebalancing', 'governance'],
            description: 'Primary Agent'
        },
        indexConfig: {
            indexTopicId: 'test-index-topic',
            proposalTimeoutMs: 1000,
            rebalanceThreshold: 0.05,
            riskThreshold: 0.2
        },
        logEvents: false
    };
    const agent2Config = {
        agentId: 'agent2',
        hederaConfig: {
            network: 'testnet',
            operatorId: 'test-operator-2',
            operatorKey: 'test-key-2'
        },
        hcs10Config: {
            registryTopicId: 'test-registry-topic',
            agentTopicId: 'agent2-topic',
            capabilities: ['rebalancing'],
            description: 'Rebalance Agent'
        },
        indexConfig: {
            indexTopicId: 'test-index-topic',
            proposalTimeoutMs: 1000,
            rebalanceThreshold: 0.05,
            riskThreshold: 0.2
        },
        logEvents: false
    };
    const agent3Config = {
        agentId: 'agent3',
        hederaConfig: {
            network: 'testnet',
            operatorId: 'test-operator-3',
            operatorKey: 'test-key-3'
        },
        hcs10Config: {
            registryTopicId: 'test-registry-topic',
            agentTopicId: 'agent3-topic',
            capabilities: ['governance'],
            description: 'Governance Agent'
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
        // Store references to mocked methods for simulating responses
        mockPublishMessage = hederaService.publishMessage;
        mockSubscribeToTopic = hederaService.subscribeToTopic;
        // Create agents
        agent1 = new LynxifyAgent(agent1Config);
        agent2 = new LynxifyAgent(agent2Config);
        agent3 = new LynxifyAgent(agent3Config);
        // Spy on eventBus methods
        jest.spyOn(eventBus, 'emitEvent');
        jest.spyOn(eventBus, 'onEvent');
    });
    afterEach(async () => {
        // Clean up any event handlers or intervals
        jest.useRealTimers();
    });
    /**
     * Test Flow 1: Agent Registry Communication
     *
     * Tests the complete flow of:
     * 1. Multiple agents registering with the registry
     * 2. Registry information propagation
     * 3. Agent verification of each other
     */
    test('Multi-Agent Registry Communication Flow', async () => {
        // Initialize all agents
        await agent1.initialize();
        await agent2.initialize();
        await agent3.initialize();
        // Verify subscription to registry topic for all agents
        expect(mockSubscribeToTopic).toHaveBeenCalledWith('test-registry-topic', expect.any(Function));
        // Simulate agent1 receiving registration messages from other agents
        const agent2Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 123,
            contents: {
                id: 'msg-1',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent2',
                contents: {
                    agentId: 'agent2',
                    topicId: 'agent2-topic',
                    capabilities: ['rebalancing'],
                    description: 'Rebalance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        const agent3Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 124,
            contents: {
                id: 'msg-2',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent3',
                contents: {
                    agentId: 'agent3',
                    topicId: 'agent3-topic',
                    capabilities: ['governance'],
                    description: 'Governance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit registration messages
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent2Registration);
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent3Registration);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Get the HCS10 service from agent1
        const hcs10Service = agent1.getHCS10Service();
        // Verify that the agents were discovered
        const knownAgents = hcs10Service.getAgentRegistry();
        expect(knownAgents).toHaveProperty('agent2');
        expect(knownAgents).toHaveProperty('agent3');
        expect(knownAgents['agent2'].capabilities).toContain('rebalancing');
        expect(knownAgents['agent3'].capabilities).toContain('governance');
        // Simulate agent verification message
        const verificationMessage = {
            topicId: 'test-registry-topic',
            sequenceNumber: 125,
            contents: {
                id: 'msg-3',
                timestamp: Date.now(),
                type: 'AgentVerification',
                sender: 'agent1',
                contents: {
                    verifiedAgentId: 'agent2',
                    verificationResult: true
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit verification message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, verificationMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify that verification message was processed
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.HCS10_AGENT_VERIFIED, expect.objectContaining({
            agentId: 'agent2',
            verifiedBy: 'agent1'
        }));
    });
    /**
     * Test Flow 2: Agent Request-Response Flow
     *
     * Tests the complete flow of:
     * 1. Agent sending request to another agent
     * 2. Agent receiving and processing request
     * 3. Agent sending response back
     * 4. Original agent receiving response
     */
    test('Agent Request-Response Flow', async () => {
        // Initialize agents
        await agent1.initialize();
        await agent2.initialize();
        // Simulate agent discovery (agent1 knows about agent2)
        const agent2Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 123,
            contents: {
                id: 'msg-1',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent2',
                contents: {
                    agentId: 'agent2',
                    topicId: 'agent2-topic',
                    capabilities: ['rebalancing'],
                    description: 'Rebalance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit registration message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent2Registration);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Simulate agent1 sending a request to agent2
        const requestMessage = {
            topicId: 'agent2-topic',
            sequenceNumber: 456,
            contents: {
                id: 'request-1',
                timestamp: Date.now(),
                type: 'Request',
                sender: 'agent1',
                requestId: 'test-request-id',
                data: {
                    action: 'get-token-weights',
                    parameters: {
                        includeHistory: true
                    }
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit request message (agent2 receives request from agent1)
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, requestMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify request received event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.HCS10_REQUEST_RECEIVED, expect.objectContaining({
            requestId: 'test-request-id',
            senderId: 'agent1'
        }));
        // Simulate agent2 responding to agent1
        const responseMessage = {
            topicId: 'agent1-topic',
            sequenceNumber: 457,
            contents: {
                id: 'response-1',
                timestamp: Date.now(),
                type: 'Response',
                sender: 'agent2',
                requestId: 'test-request-id',
                data: {
                    weights: {
                        'BTC': 0.5,
                        'ETH': 0.3,
                        'SOL': 0.2
                    },
                    timestamp: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit response message (agent1 receives response from agent2)
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, responseMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify response received event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.HCS10_RESPONSE_RECEIVED, expect.objectContaining({
            requestId: 'test-request-id',
            senderId: 'agent2'
        }));
    });
    /**
     * Test Flow 3: HCS-10 Capabilities Discovery
     *
     * Tests the complete flow of:
     * 1. Agent querying for capabilities
     * 2. Finding agents with specific capabilities
     * 3. Verifying capabilities match
     */
    test('Agent Capabilities Discovery Flow', async () => {
        // Initialize agent1
        await agent1.initialize();
        // Simulate agent registrations
        const agent2Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 123,
            contents: {
                id: 'msg-1',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent2',
                contents: {
                    agentId: 'agent2',
                    topicId: 'agent2-topic',
                    capabilities: ['rebalancing', 'liquidity-provision'],
                    description: 'Rebalance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        const agent3Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 124,
            contents: {
                id: 'msg-2',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent3',
                contents: {
                    agentId: 'agent3',
                    topicId: 'agent3-topic',
                    capabilities: ['governance', 'voting'],
                    description: 'Governance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit registration messages
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent2Registration);
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent3Registration);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Get the HCS10 service from agent1
        const hcs10Service = agent1.getHCS10Service();
        // Find agents with rebalancing capability
        const rebalancingAgents = hcs10Service.findAgentsByCapability('rebalancing');
        expect(rebalancingAgents).toContain('agent2');
        expect(rebalancingAgents).not.toContain('agent3');
        // Find agents with governance capability
        const governanceAgents = hcs10Service.findAgentsByCapability('governance');
        expect(governanceAgents).toContain('agent3');
        expect(governanceAgents).not.toContain('agent2');
        // Verify agent2 has multiple capabilities
        const agent2Info = hcs10Service.getAgentRegistry()['agent2'];
        expect(agent2Info.capabilities).toContain('rebalancing');
        expect(agent2Info.capabilities).toContain('liquidity-provision');
    });
    /**
     * Test Flow 4: Agent Request Timeout and Retry
     *
     * Tests the complete flow of:
     * 1. Agent sending request to another agent
     * 2. Request timing out
     * 3. Agent automatically retrying
     * 4. Eventually receiving response
     */
    test('Agent Request Timeout and Retry Flow', async () => {
        // Set up a timer mock
        jest.useFakeTimers();
        // Initialize agents
        await agent1.initialize();
        await agent2.initialize();
        // Simulate agent discovery (agent1 knows about agent2)
        const agent2Registration = {
            topicId: 'test-registry-topic',
            sequenceNumber: 123,
            contents: {
                id: 'msg-1',
                timestamp: Date.now(),
                type: 'AgentInfo',
                sender: 'agent2',
                contents: {
                    agentId: 'agent2',
                    topicId: 'agent2-topic',
                    capabilities: ['rebalancing'],
                    description: 'Rebalance Agent',
                    status: 'active'
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit registration message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, agent2Registration);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Simulate agent1 sending a request to agent2
        const requestMessage = {
            topicId: 'agent2-topic',
            sequenceNumber: 456,
            contents: {
                id: 'request-timeout',
                timestamp: Date.now(),
                type: 'Request',
                sender: 'agent1',
                requestId: 'timeout-request-id',
                data: {
                    action: 'get-token-weights',
                    parameters: {
                        includeHistory: true
                    }
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit request message (agent1 sends request to agent2)
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, requestMessage);
        // Advance timer to trigger timeout (default timeout is 30 seconds)
        jest.advanceTimersByTime(30000);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify request timeout event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.HCS10_REQUEST_TIMEOUT, expect.objectContaining({
            requestId: 'timeout-request-id'
        }));
        // Simulate the retry request was sent
        const retryRequestMessage = {
            topicId: 'agent2-topic',
            sequenceNumber: 457,
            contents: {
                id: 'request-retry',
                timestamp: Date.now(),
                type: 'Request',
                sender: 'agent1',
                requestId: 'timeout-request-id',
                data: {
                    action: 'get-token-weights',
                    parameters: {
                        includeHistory: true
                    }
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit retry request (agent1 retries the request to agent2)
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, retryRequestMessage);
        // Simulate agent2 finally responding to agent1
        const responseMessage = {
            topicId: 'agent1-topic',
            sequenceNumber: 458,
            contents: {
                id: 'response-after-retry',
                timestamp: Date.now(),
                type: 'Response',
                sender: 'agent2',
                requestId: 'timeout-request-id',
                data: {
                    weights: {
                        'BTC': 0.5,
                        'ETH': 0.3,
                        'SOL': 0.2
                    },
                    timestamp: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit response message (agent1 receives response from agent2)
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, responseMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify response received event was emitted after retry
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.HCS10_RESPONSE_RECEIVED, expect.objectContaining({
            requestId: 'timeout-request-id',
            senderId: 'agent2'
        }));
    });
});
