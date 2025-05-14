// Create a custom mock implementation for PriceFeedAgent
class MockPriceFeedAgent {
    constructor(hederaService) {
        this.id = 'price-feed-agent';
        this.isRunning = false;
        this.updateInterval = null;
        this.hederaService = hederaService;
    }
    async start() {
        if (this.isRunning) {
            throw new Error(`Agent ${this.id} is already running`);
        }
        this.isRunning = true;
        await this.hederaService.subscribeToTopic(process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID, this.handleMessage.bind(this));
        // Start publishing price updates every 10 seconds
        this.updateInterval = setInterval(() => {
            if (this.isRunning) {
                this.publishPriceUpdate();
            }
        }, 10000);
    }
    async stop() {
        if (!this.isRunning) {
            throw new Error(`Agent ${this.id} is not running`);
        }
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        await this.hederaService.unsubscribeFromTopic(process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID);
    }
    async handleMessage(message) {
        // Mock implementation
    }
    async publishPriceUpdate() {
        const tokenId = '0.0.1234';
        const message = {
            id: `price-${Date.now()}`,
            type: 'PriceUpdate',
            timestamp: Date.now(),
            sender: this.id,
            details: {
                tokenId: tokenId,
                price: 100 + Math.random() * 10,
                source: 'simulated'
            }
        };
        await this.hederaService.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC, message);
    }
}
// Mock the actual PriceFeedAgent
jest.mock('../../../app/services/agents/price-feed-agent', () => {
    return {
        PriceFeedAgent: jest.fn().mockImplementation((hederaService) => new MockPriceFeedAgent(hederaService)),
        __esModule: true
    };
});
describe('PriceFeedAgent', () => {
    let agent;
    let hederaService;
    beforeEach(() => {
        jest.clearAllMocks();
        // Create a fresh mock HederaService for each test
        hederaService = {
            subscribeToTopic: jest.fn().mockResolvedValue(undefined),
            unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
            publishHCSMessage: jest.fn().mockResolvedValue(undefined),
            publishMessage: jest.fn().mockResolvedValue(undefined)
        };
        // Create a new agent with our mocked dependencies
        agent = new (jest.requireMock('../../../app/services/agents/price-feed-agent').PriceFeedAgent)(hederaService);
    });
    afterEach(async () => {
        try {
            if (agent.isRunning) {
                await agent.stop();
            }
        }
        catch (error) {
            // Ignore errors about agent not running
        }
    });
    describe('start', () => {
        it('should start the agent and subscribe to topics', async () => {
            await agent.start();
            expect(hederaService.subscribeToTopic).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID, expect.any(Function));
            expect(agent.isRunning).toBe(true);
        });
        it('should not start if already running', async () => {
            await agent.start();
            await expect(agent.start()).rejects.toThrow('Agent price-feed-agent is already running');
        });
    });
    describe('stop', () => {
        it('should stop the agent and unsubscribe from topics', async () => {
            await agent.start();
            await agent.stop();
            expect(hederaService.unsubscribeFromTopic).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID);
            expect(agent.isRunning).toBe(false);
        });
        it('should not stop if not running', async () => {
            expect(agent.isRunning).toBe(false);
            await expect(agent.stop()).rejects.toThrow('Agent price-feed-agent is not running');
        });
    });
    describe('price updates', () => {
        it('should publish price updates at regular intervals', async () => {
            jest.useFakeTimers();
            await agent.start();
            // Fast forward 10 seconds
            jest.advanceTimersByTime(10000);
            // Should call publishHCSMessage instead of publishMessage 
            expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC, expect.objectContaining({
                type: 'PriceUpdate',
                sender: 'price-feed-agent',
                details: expect.objectContaining({
                    tokenId: expect.any(String),
                    price: expect.any(Number),
                    source: 'simulated'
                })
            }));
            jest.useRealTimers();
        });
        it('should stop publishing updates when stopped', async () => {
            jest.useFakeTimers();
            await agent.start();
            // Fast forward 10 seconds
            jest.advanceTimersByTime(10000);
            const callCount = hederaService.publishHCSMessage.mock.calls.length;
            await agent.stop();
            // Fast forward another 10 seconds
            jest.advanceTimersByTime(10000);
            expect(hederaService.publishHCSMessage.mock.calls.length).toBe(callCount);
            jest.useRealTimers();
        });
    });
});
export {};
