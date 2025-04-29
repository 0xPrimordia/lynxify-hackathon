import { BaseAgent } from '@/app/services/agents/base-agent';
import { HederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';

jest.mock('../../../app/services/hedera');

describe('BaseAgent', () => {
  let agent: BaseAgent;
  let hederaService: jest.Mocked<HederaService>;

  // Create a concrete implementation of BaseAgent for testing
  class TestAgent extends BaseAgent {
    constructor(hederaService: HederaService) {
      super({
        id: 'test-agent',
        type: 'price-feed',
        hederaService,
        topics: {
          input: 'test-input-topic',
          output: 'test-output-topic'
        }
      });
    }

    protected async handleMessage(message: HCSMessage): Promise<void> {
      // Test implementation
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService() as jest.Mocked<HederaService>;
    agent = new TestAgent(hederaService);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent).toBeDefined();
      expect(agent['id']).toBe('test-agent');
      expect(agent['type']).toBe('price-feed');
      expect(agent['inputTopic']).toBe('test-input-topic');
      expect(agent['outputTopic']).toBe('test-output-topic');
    });
  });

  describe('start', () => {
    it('should start the agent and subscribe to input topic', async () => {
      await agent.start();
      expect(hederaService.subscribeToTopic).toHaveBeenCalledWith(
        'test-input-topic',
        expect.any(Function)
      );
      expect(agent['isRunning']).toBe(true);
    });

    it('should not start if already running', async () => {
      await agent.start();
      await expect(agent.start()).rejects.toThrow('Agent test-agent is already running');
    });
  });

  describe('stop', () => {
    it('should stop the agent and unsubscribe from input topic', async () => {
      await agent.start();
      await agent.stop();
      expect(hederaService.unsubscribeFromTopic).toHaveBeenCalledWith('test-input-topic');
      expect(agent['isRunning']).toBe(false);
    });

    it('should not stop if not running', async () => {
      await expect(agent.stop()).rejects.toThrow('Agent test-agent is not running');
    });
  });

  describe('publishMessage', () => {
    it('should publish message to output topic when running', async () => {
      const message: HCSMessage = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'test-agent',
        tokenId: '0.0.123',
        price: 100,
        source: 'test'
      };

      await agent.start();
      await agent['publishMessage'](message);

      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        'test-output-topic',
        message
      );
    });

    it('should not publish message when not running', async () => {
      const message: HCSMessage = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'test-agent',
        tokenId: '0.0.123',
        price: 100,
        source: 'test'
      };

      await expect(agent['publishMessage'](message))
        .rejects.toThrow('Agent test-agent is not running');
    });
  });
}); 