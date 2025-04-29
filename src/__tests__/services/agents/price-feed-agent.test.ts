import { PriceFeedAgent } from '../../../app/services/agents/price-feed-agent';
import { HederaService } from '../../../app/services/hedera';
import { PriceUpdate } from '../../../app/types/hcs';

jest.mock('../../../app/services/hedera');

describe('PriceFeedAgent', () => {
  let agent: PriceFeedAgent;
  let hederaService: jest.Mocked<HederaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService() as jest.Mocked<HederaService>;
    agent = new PriceFeedAgent(hederaService);
  });

  afterEach(async () => {
    try {
      await agent.stop();
    } catch (error) {
      // Ignore errors about agent not running
    }
  });

  describe('start', () => {
    it('should start the agent and subscribe to topics', async () => {
      await agent.start();
      expect(hederaService.subscribeToTopic).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID,
        expect.any(Function)
      );
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
      expect(hederaService.unsubscribeFromTopic).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID
      );
    });

    it('should not stop if not running', async () => {
      await expect(agent.stop()).rejects.toThrow('Agent price-feed-agent is not running');
    });
  });

  describe('price updates', () => {
    it('should publish price updates at regular intervals', async () => {
      jest.useFakeTimers();
      await agent.start();

      // Fast forward 10 seconds
      jest.advanceTimersByTime(10000);

      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_AGENT_TOPIC_ID,
        expect.objectContaining({
          type: 'PriceUpdate',
          sender: 'price-feed-agent',
          tokenId: expect.any(String),
          price: expect.any(Number),
          source: 'simulated'
        } as PriceUpdate)
      );

      jest.useRealTimers();
    });

    it('should stop publishing updates when stopped', async () => {
      jest.useFakeTimers();
      await agent.start();

      // Fast forward 10 seconds
      jest.advanceTimersByTime(10000);
      const callCount = (hederaService.publishMessage as jest.Mock).mock.calls.length;

      await agent.stop();

      // Fast forward another 10 seconds
      jest.advanceTimersByTime(10000);
      expect((hederaService.publishMessage as jest.Mock).mock.calls.length).toBe(callCount);

      jest.useRealTimers();
    });
  });
}); 