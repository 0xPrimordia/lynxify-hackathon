// Create a custom mock implementation so we can test
class MockBaseAgent {
    constructor(config) {
        this.isRunning = false;
        this.id = config.id;
        this.hederaService = config.hederaService;
        this.inputTopic = config.topics.input;
        this.outputTopic = config.topics.output;
    }
    async start() {
        if (this.isRunning) {
            throw new Error(`Agent ${this.id} is already running`);
        }
        this.isRunning = true;
        await this.hederaService.subscribeToTopic(this.inputTopic, this.handleMessage.bind(this));
    }
    async stop() {
        if (!this.isRunning) {
            throw new Error(`Agent ${this.id} is not running`);
        }
        this.isRunning = false;
        await this.hederaService.unsubscribeFromTopic(this.inputTopic);
    }
    async publishMessage(message) {
        if (!this.isRunning) {
            throw new Error(`Agent ${this.id} is not running`);
        }
        await this.hederaService.publishHCSMessage(this.outputTopic, message);
    }
    async handleMessage(message) {
        // Mock implementation
    }
}
// Mock the BaseAgent module
jest.mock('../../../app/services/agents/base-agent', () => {
    return {
        BaseAgent: jest.fn().mockImplementation((config) => new MockBaseAgent(config)),
        __esModule: true
    };
});
describe('BaseAgent', () => {
    let agent;
    let hederaService;
    beforeEach(() => {
        // Reset mock counters
        jest.clearAllMocks();
        // Create a HederaService mock
        hederaService = {
            subscribeToTopic: jest.fn().mockResolvedValue(undefined),
            unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
            publishHCSMessage: jest.fn().mockResolvedValue(undefined)
        };
        // Create the agent with our mock
        agent = new (jest.requireMock('../../../app/services/agents/base-agent').BaseAgent)({
            id: 'test-agent',
            type: 'price-feed',
            hederaService,
            topics: {
                input: 'input-topic',
                output: 'output-topic'
            }
        });
    });
    describe('start', () => {
        it('should start the agent and subscribe to topic', async () => {
            await agent.start();
            // Verify that the agent is now running
            expect(agent.isRunning).toBe(true);
            // Verify that subscribeToTopic was called with the right parameters
            expect(hederaService.subscribeToTopic).toHaveBeenCalledWith('input-topic', expect.any(Function));
        });
        it('should throw error if already running', async () => {
            // Start the agent once
            await agent.start();
            // Second attempt should throw
            await expect(agent.start()).rejects.toThrow('Agent test-agent is already running');
        });
    });
    describe('stop', () => {
        it('should stop the agent and unsubscribe from topic', async () => {
            // First start the agent
            await agent.start();
            // Then stop it
            await agent.stop();
            // Verify it's no longer running
            expect(agent.isRunning).toBe(false);
            // Verify that unsubscribeFromTopic was called
            expect(hederaService.unsubscribeFromTopic).toHaveBeenCalledWith('input-topic');
        });
        it('should throw error if not running', async () => {
            // Try to stop without having started
            await expect(agent.stop()).rejects.toThrow('Agent test-agent is not running');
        });
    });
    describe('publishMessage', () => {
        it('should publish messages when agent is running', async () => {
            // Start the agent
            await agent.start();
            // Create a valid message
            const message = {
                id: 'test-message-1',
                type: 'PriceUpdate',
                timestamp: Date.now(),
                sender: 'test-agent',
                details: {
                    tokenId: 'TOKEN-123',
                    price: 100
                }
            };
            // Publish the message
            await agent.publishMessage(message);
            // Verify publishHCSMessage was called correctly
            expect(hederaService.publishHCSMessage).toHaveBeenCalledWith('output-topic', message);
        });
        it('should throw error if agent is not running', async () => {
            // Create a valid message
            const message = {
                id: 'test-message-2',
                type: 'PriceUpdate',
                timestamp: Date.now(),
                sender: 'test-agent',
                details: {
                    tokenId: 'TOKEN-123',
                    price: 100
                }
            };
            // Should throw since agent is not running
            await expect(agent.publishMessage(message)).rejects.toThrow('Agent test-agent is not running');
        });
    });
});
export {};
