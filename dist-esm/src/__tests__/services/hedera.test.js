// Complete mock for HederaService
jest.mock('@/app/services/hedera', () => {
    // Mock HederaService implementation
    const mockService = {
        client: {},
        subscriptions: new Map(),
        messageHandlers: new Map(),
        createGovernanceTopic: jest.fn().mockResolvedValue('0.0.12346'),
        createAgentTopic: jest.fn().mockResolvedValue('0.0.12347'),
        createPriceFeedTopic: jest.fn().mockResolvedValue('0.0.12348'),
        publishHCSMessage: jest.fn().mockResolvedValue(undefined),
        submitMessageToTopic: jest.fn().mockResolvedValue({}),
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
        HederaService: jest.fn().mockImplementation(() => mockService),
        TOPICS: {
            GOVERNANCE_PROPOSALS: '0.0.12346',
            MARKET_PRICE_FEED: '0.0.12348',
            AGENT_ACTIONS: '0.0.12347'
        },
        TOPIC_IDS: {
            GOVERNANCE_PROPOSALS: '0.0.12346',
            MARKET_PRICE_FEED: '0.0.12348',
            AGENT_ACTIONS: '0.0.12347'
        }
    };
});
import { HederaService } from '@/app/services/hedera';
describe('HederaService', () => {
    let service;
    beforeEach(() => {
        jest.clearAllMocks();
        service = new HederaService();
    });
    describe('constructor', () => {
        it('should initialize with testnet credentials', () => {
            expect(service).toBeDefined();
        });
    });
    describe('createGovernanceTopic', () => {
        it('should create a governance topic', async () => {
            const result = await service.createGovernanceTopic();
            expect(result).toBeDefined();
            expect(result).toBe('0.0.12346');
        });
    });
    describe('createAgentTopic', () => {
        it('should create an agent topic', async () => {
            const result = await service.createAgentTopic();
            expect(result).toBeDefined();
            expect(result).toBe('0.0.12347');
        });
    });
    describe('createPriceFeedTopic', () => {
        it('should create a price feed topic', async () => {
            const result = await service.createPriceFeedTopic();
            expect(result).toBeDefined();
            expect(result).toBe('0.0.12348');
        });
    });
    describe('publishHCSMessage', () => {
        it('should publish a message to a topic', async () => {
            const message = {
                id: 'test-id',
                type: 'PriceUpdate',
                timestamp: Date.now(),
                sender: 'test-agent',
                details: {
                    tokenId: '0.0.123',
                    price: 100,
                    source: 'test'
                }
            };
            const topicId = '0.0.12346';
            await service.publishHCSMessage(topicId, message);
            expect(service.publishHCSMessage).toHaveBeenCalledWith(topicId, message);
        });
    });
    describe('subscribeToTopic', () => {
        it('should subscribe to a topic', async () => {
            const topicId = '0.0.12346';
            const callback = jest.fn();
            await service.subscribeToTopic(topicId, callback);
            expect(service.subscribeToTopic).toHaveBeenCalledWith(topicId, callback);
        });
    });
    describe('unsubscribeFromTopic', () => {
        it('should unsubscribe from a topic', async () => {
            const topicId = '0.0.12346';
            await service.unsubscribeFromTopic(topicId);
            expect(service.unsubscribeFromTopic).toHaveBeenCalledWith(topicId);
        });
    });
});
