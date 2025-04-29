import { RiskAssessmentAgent } from '@/app/services/agents/risk-assessment-agent';
import { HederaService } from '@/app/services/hedera';
import { PriceUpdate, RiskAlert } from '@/app/types/hcs';

jest.mock('../../../app/services/hedera');

describe('RiskAssessmentAgent', () => {
  let agent: RiskAssessmentAgent;
  let hederaService: jest.Mocked<HederaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService() as jest.Mocked<HederaService>;
    agent = new RiskAssessmentAgent(hederaService);
  });

  describe('handleMessage', () => {
    it('should handle PriceUpdate messages', async () => {
      const priceUpdate: PriceUpdate = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        tokenId: '0.0.123',
        price: 100,
        source: 'test'
      };

      await agent.start();
      await agent['handleMessage'](priceUpdate);

      // Verify price history was updated
      expect(agent['priceHistory'].get('0.0.123')).toHaveLength(1);
    });

    it('should ignore non-PriceUpdate messages', async () => {
      const otherMessage = {
        type: 'OtherMessage',
        timestamp: Date.now(),
        sender: 'other-agent'
      };

      await agent.start();
      await agent['handleMessage'](otherMessage as any);

      // Verify no price history was updated
      expect(agent['priceHistory'].size).toBe(0);
    });
  });

  describe('handlePriceUpdate', () => {
    it('should detect high risk and publish alert', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const highRiskPrice = initialPrice * 1.15; // 15% increase

      // Add initial price to history
      agent['priceHistory'].set(tokenId, [initialPrice]);

      const priceUpdate: PriceUpdate = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        tokenId,
        price: highRiskPrice,
        source: 'test'
      };

      await agent.start();
      await agent['handleMessage'](priceUpdate);

      // Verify risk alert was published
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RiskAlert',
          severity: 'high',
          affectedTokens: [tokenId],
          metrics: expect.objectContaining({
            priceChange: expect.any(Number),
            volatility: expect.any(Number)
          })
        } as RiskAlert)
      );
    });

    it('should detect medium risk and publish alert', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const mediumRiskPrice = initialPrice * 1.07; // 7% increase

      // Add initial price to history
      agent['priceHistory'].set(tokenId, [initialPrice]);

      const priceUpdate: PriceUpdate = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        tokenId,
        price: mediumRiskPrice,
        source: 'test'
      };

      await agent.start();
      await agent['handleMessage'](priceUpdate);

      // Verify risk alert was published
      expect(hederaService.publishMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'RiskAlert',
          severity: 'medium',
          affectedTokens: [tokenId]
        } as RiskAlert)
      );
    });

    it('should not publish alert for low risk changes', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const lowRiskPrice = initialPrice * 1.01; // 1% increase

      // Add initial price to history
      agent['priceHistory'].set(tokenId, [initialPrice]);

      const priceUpdate: PriceUpdate = {
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        tokenId,
        price: lowRiskPrice,
        source: 'test'
      };

      await agent.start();
      await agent['handleMessage'](priceUpdate);

      // Verify no risk alert was published
      expect(hederaService.publishMessage).not.toHaveBeenCalled();
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate volatility correctly', () => {
      const prices = [100, 105, 98, 102, 103];
      const volatility = agent['calculateVolatility'](prices);
      
      // Verify volatility is a positive number
      expect(volatility).toBeGreaterThan(0);
      expect(typeof volatility).toBe('number');
    });

    it('should return 0 for insufficient price history', () => {
      const prices = [100];
      const volatility = agent['calculateVolatility'](prices);
      expect(volatility).toBe(0);
    });
  });
}); 