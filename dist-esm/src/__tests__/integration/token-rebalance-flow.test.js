import { LynxifyAgent } from '../../app/services/lynxify-agent';
import { SharedHederaService } from '../../app/services/shared-hedera-service';
import { TokenService } from '../../app/services/token-service';
import { PriceFeedService } from '../../app/services/price-feed-service';
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
            }),
            getTokenBalances: jest.fn().mockResolvedValue(mockTokenBalances),
            getBalance: jest.fn().mockImplementation((tokenId) => {
                const symbol = Object.entries({
                    'BTC': '0.0.1001',
                    'ETH': '0.0.1002',
                    'SOL': '0.0.1003',
                    'LYNX': '0.0.1004'
                }).find(([_, id]) => id === tokenId)?.[0];
                return Promise.resolve(symbol ? mockTokenBalances[symbol] : 0);
            }),
            mintTokens: jest.fn().mockImplementation((tokenId, amount) => {
                const symbol = Object.entries({
                    'BTC': '0.0.1001',
                    'ETH': '0.0.1002',
                    'SOL': '0.0.1003',
                    'LYNX': '0.0.1004'
                }).find(([_, id]) => id === tokenId)?.[0];
                if (symbol) {
                    mockTokenBalances[symbol] += amount;
                }
                return Promise.resolve(true);
            }),
            burnTokens: jest.fn().mockImplementation((tokenId, amount) => {
                const symbol = Object.entries({
                    'BTC': '0.0.1001',
                    'ETH': '0.0.1002',
                    'SOL': '0.0.1003',
                    'LYNX': '0.0.1004'
                }).find(([_, id]) => id === tokenId)?.[0];
                if (symbol && mockTokenBalances[symbol] >= amount) {
                    mockTokenBalances[symbol] -= amount;
                }
                return Promise.resolve(true);
            }),
            calculateAdjustments: jest.fn().mockImplementation(() => ({
                'BTC': 5,
                'ETH': -2,
                'SOL': -3
            })),
            // Reset token balances for testing
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
        }),
        getPriceHistory: jest.fn().mockReturnValue([
            { symbol: 'BTC', tokenId: '0.0.1001', price: 49000, timestamp: Date.now() - 86400000, source: 'test' },
            { symbol: 'BTC', tokenId: '0.0.1001', price: 50000, timestamp: Date.now(), source: 'test' }
        ]),
        isInitialized: jest.fn().mockReturnValue(true),
        cleanup: jest.fn()
    }))
}));
describe('Token Rebalance Integration Flow', () => {
    let agent;
    let hederaService;
    let tokenService;
    let priceFeedService;
    let indexService;
    let eventBus;
    const agentConfig = {
        agentId: 'test-agent',
        hederaConfig: {
            network: 'testnet',
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
        // Reset token balances for fresh tests
        tokenService.resetBalances();
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
        // Get token service reference for verification
        indexService = agent.getIndexService();
        // Spy on eventBus methods
        jest.spyOn(eventBus, 'emitEvent');
        jest.spyOn(eventBus, 'onEvent');
        // Spy on token service methods
        jest.spyOn(tokenService, 'mintTokens');
        jest.spyOn(tokenService, 'burnTokens');
        jest.spyOn(tokenService, 'getTokenBalances');
    });
    afterEach(async () => {
        // Clean up any event handlers or intervals
        jest.useRealTimers();
    });
    /**
     * Test Flow 1: Price-Based Rebalance Flow with Token Operations
     *
     * Tests the complete flow of:
     * 1. Agent initializes with token balances
     * 2. Price update causes rebalance proposal
     * 3. Rebalance is approved
     * 4. Token operations execute rebalance (mint/burn)
     * 5. Final balances reflect rebalance
     */
    test('Price-Based Rebalance Flow with Token Operations', async () => {
        // Initialize agent
        await agent.initialize();
        // Verify initial token balances
        const initialBalances = await tokenService.getTokenBalances();
        expect(initialBalances).toEqual({
            'BTC': 10,
            'ETH': 50,
            'SOL': 500,
            'LYNX': 1000
        });
        // Simulate significant price change to trigger rebalance
        const priceUpdate = {
            tokenId: '0.0.1001', // BTC
            price: 70000, // 40% increase
            source: 'test-feed'
        };
        // Emit price update event
        eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, priceUpdate);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify that a rebalance proposal was triggered (threshold was exceeded)
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.INDEX_REBALANCE_PROPOSED, expect.objectContaining({
            proposalId: expect.any(String),
            trigger: 'price_deviation'
        }));
        // Extract the proposal ID from the emitted event
        const proposalEvents = eventBus.emitEvent.mock.calls.filter(call => call[0] === EventType.INDEX_REBALANCE_PROPOSED);
        const proposalId = proposalEvents[0][1].proposalId;
        // Simulate rebalance approval
        const approvalMessage = {
            topicId: 'test-index-topic',
            sequenceNumber: 456,
            contents: {
                id: 'approval-1',
                timestamp: Date.now(),
                type: 'RebalanceApproved',
                sender: 'test-agent',
                details: {
                    proposalId,
                    approvedAt: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit approval message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, approvalMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify rebalance approval event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.INDEX_REBALANCE_APPROVED, expect.objectContaining({
            proposalId
        }));
        // Simulate execution request
        const executionMessage = {
            topicId: 'test-index-topic',
            sequenceNumber: 457,
            contents: {
                id: 'execution-1',
                timestamp: Date.now(),
                type: 'RebalanceExecute',
                sender: 'test-agent',
                details: {
                    proposalId
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit execution message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, executionMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 200));
        // Verify token operations were called
        expect(tokenService.mintTokens).toHaveBeenCalled();
        expect(tokenService.burnTokens).toHaveBeenCalled();
        // Verify rebalance execution event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.INDEX_REBALANCE_EXECUTED, expect.objectContaining({
            proposalId
        }));
        // Verify final balances reflect the rebalance
        const finalBalances = await tokenService.getTokenBalances();
        expect(finalBalances).not.toEqual(initialBalances);
        // The mock calculateAdjustments returns BTC: +5, ETH: -2, SOL: -3
        expect(finalBalances.BTC).toBe(initialBalances.BTC + 5);
        expect(finalBalances.ETH).toBe(initialBalances.ETH - 2);
        expect(finalBalances.SOL).toBe(initialBalances.SOL - 3);
        expect(finalBalances.LYNX).toBe(initialBalances.LYNX); // LYNX is not part of the adjustment
    });
    /**
     * Test Flow 2: Risk-Based Rebalance Flow
     *
     * Tests the complete flow of:
     * 1. Agent initializes with token balances
     * 2. Risk assessment triggers rebalance proposal
     * 3. Rebalance is approved
     * 4. Token operations execute rebalance
     * 5. Final balances reflect rebalance
     */
    test('Risk-Based Rebalance Flow', async () => {
        // Initialize agent
        await agent.initialize();
        // Verify initial token balances
        const initialBalances = await tokenService.getTokenBalances();
        // Simulate risk alert
        const riskAlert = {
            severity: 'high',
            riskDescription: 'Excessive volatility detected in SOL token',
            affectedTokens: ['0.0.1003'] // SOL token ID
        };
        // Emit risk alert event
        eventBus.emitEvent(EventType.INDEX_RISK_ALERT, riskAlert);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify that a rebalance proposal was triggered by risk
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.INDEX_REBALANCE_PROPOSED, expect.objectContaining({
            proposalId: expect.any(String),
            trigger: 'risk_threshold'
        }));
        // Extract the proposal ID from the emitted event
        const proposalEvents = eventBus.emitEvent.mock.calls.filter(call => call[0] === EventType.INDEX_REBALANCE_PROPOSED);
        // Get the last proposal (should be the risk-based one)
        const proposalId = proposalEvents[proposalEvents.length - 1][1].proposalId;
        // Simulate rebalance approval
        const approvalMessage = {
            topicId: 'test-index-topic',
            sequenceNumber: 458,
            contents: {
                id: 'approval-2',
                timestamp: Date.now(),
                type: 'RebalanceApproved',
                sender: 'test-agent',
                details: {
                    proposalId,
                    approvedAt: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit approval message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, approvalMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Simulate execution request
        const executionMessage = {
            topicId: 'test-index-topic',
            sequenceNumber: 459,
            contents: {
                id: 'execution-2',
                timestamp: Date.now(),
                type: 'RebalanceExecute',
                sender: 'test-agent',
                details: {
                    proposalId
                }
            },
            consensusTimestamp: new Date().toString()
        };
        // Emit execution message
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, executionMessage);
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 200));
        // Verify token operations were called again
        expect(tokenService.mintTokens).toHaveBeenCalled();
        expect(tokenService.burnTokens).toHaveBeenCalled();
        // Verify rebalance execution event was emitted
        expect(eventBus.emitEvent).toHaveBeenCalledWith(EventType.INDEX_REBALANCE_EXECUTED, expect.objectContaining({
            proposalId
        }));
        // Verify final balances differ from initial balances
        const finalBalances = await tokenService.getTokenBalances();
        expect(finalBalances).not.toEqual(initialBalances);
    });
    /**
     * Test Flow 3: Multiple Rebalances in Sequence
     *
     * Tests the complete flow of:
     * 1. Multiple price updates in sequence
     * 2. Agent handles multiple rebalances correctly
     * 3. Final state reflects cumulative changes
     */
    test('Multiple Sequential Rebalances', async () => {
        // Initialize agent
        await agent.initialize();
        // Verify initial token balances
        const initialBalances = await tokenService.getTokenBalances();
        // Simulate first price update
        eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
            tokenId: '0.0.1001', // BTC
            price: 60000, // 20% increase
            source: 'test-feed'
        });
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Extract the first proposal ID
        const proposalEvents1 = eventBus.emitEvent.mock.calls.filter(call => call[0] === EventType.INDEX_REBALANCE_PROPOSED);
        const proposalId1 = proposalEvents1[0][1].proposalId;
        // Approve and execute first rebalance
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
            topicId: 'test-index-topic',
            sequenceNumber: 460,
            contents: {
                id: 'approval-3',
                timestamp: Date.now(),
                type: 'RebalanceApproved',
                sender: 'test-agent',
                details: {
                    proposalId: proposalId1,
                    approvedAt: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        });
        // Wait for approval processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Execute first rebalance
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
            topicId: 'test-index-topic',
            sequenceNumber: 461,
            contents: {
                id: 'execution-3',
                timestamp: Date.now(),
                type: 'RebalanceExecute',
                sender: 'test-agent',
                details: {
                    proposalId: proposalId1
                }
            },
            consensusTimestamp: new Date().toString()
        });
        // Wait for execution processing
        await new Promise(resolve => setTimeout(resolve, 200));
        // Check intermediate balances
        const intermediateBalances = await tokenService.getTokenBalances();
        // Reset mock calls to track second rebalance separately
        jest.clearAllMocks();
        // Simulate second price update
        eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
            tokenId: '0.0.1002', // ETH
            price: 4000, // 33% increase
            source: 'test-feed'
        });
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Extract the second proposal ID
        const proposalEvents2 = eventBus.emitEvent.mock.calls.filter(call => call[0] === EventType.INDEX_REBALANCE_PROPOSED);
        const proposalId2 = proposalEvents2[0][1].proposalId;
        // Approve and execute second rebalance
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
            topicId: 'test-index-topic',
            sequenceNumber: 462,
            contents: {
                id: 'approval-4',
                timestamp: Date.now(),
                type: 'RebalanceApproved',
                sender: 'test-agent',
                details: {
                    proposalId: proposalId2,
                    approvedAt: Date.now()
                }
            },
            consensusTimestamp: new Date().toString()
        });
        // Wait for approval processing
        await new Promise(resolve => setTimeout(resolve, 100));
        // Execute second rebalance
        eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
            topicId: 'test-index-topic',
            sequenceNumber: 463,
            contents: {
                id: 'execution-4',
                timestamp: Date.now(),
                type: 'RebalanceExecute',
                sender: 'test-agent',
                details: {
                    proposalId: proposalId2
                }
            },
            consensusTimestamp: new Date().toString()
        });
        // Wait for execution processing
        await new Promise(resolve => setTimeout(resolve, 200));
        // Verify that token operations were called for the second rebalance
        expect(tokenService.mintTokens).toHaveBeenCalled();
        expect(tokenService.burnTokens).toHaveBeenCalled();
        // Verify final balances reflect both rebalances
        const finalBalances = await tokenService.getTokenBalances();
        expect(finalBalances).not.toEqual(initialBalances);
        expect(finalBalances).not.toEqual(intermediateBalances);
    });
});
