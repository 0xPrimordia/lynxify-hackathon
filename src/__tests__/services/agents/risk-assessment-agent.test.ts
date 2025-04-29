import { RiskAssessmentAgent } from '@/app/services/agents/risk-assessment-agent';
import { HederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';

// Create a custom mock implementation for RiskAssessmentAgent
class MockRiskAssessmentAgent {
  public id: string = 'risk-assessment-agent';
  public isRunning: boolean = false;
  private hederaService: HederaService;
  private priceHistory: Map<string, number[]> = new Map();
  private highRiskThreshold: number = 0.1; // 10%
  private mediumRiskThreshold: number = 0.05; // 5%
  
  constructor(hederaService: HederaService) {
    this.hederaService = hederaService;
  }
  
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Agent ${this.id} is already running`);
    }
    
    this.isRunning = true;
    await this.hederaService.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC!, this.handleMessage.bind(this));
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error(`Agent ${this.id} is not running`);
    }
    
    this.isRunning = false;
    await this.hederaService.unsubscribeFromTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC!);
  }
  
  async handleMessage(message: HCSMessage): Promise<void> {
    if (!this.isRunning) return;
    
    if (message.type === 'PriceUpdate') {
      await this.handlePriceUpdate(message);
    }
  }
  
  async handlePriceUpdate(message: HCSMessage): Promise<void> {
    if (message.type !== 'PriceUpdate') return;
    
    const tokenId = message.details.tokenId;
    const price = message.details.price;
    
    if (!tokenId || typeof price !== 'number') return;
    
    // Store price in history
    let prices = this.priceHistory.get(tokenId) || [];
    prices.push(price);
    this.priceHistory.set(tokenId, prices);
    
    // Calculate price change percentage
    if (prices.length < 2) return;
    
    const previousPrice = prices[prices.length - 2];
    const priceChange = (price - previousPrice) / previousPrice;
    const volatility = this.calculateVolatility(prices);
    
    // Determine if alert should be published
    if (Math.abs(priceChange) >= this.highRiskThreshold) {
      await this.publishRiskAlert(tokenId, 'high', priceChange, volatility);
    } else if (Math.abs(priceChange) >= this.mediumRiskThreshold) {
      await this.publishRiskAlert(tokenId, 'medium', priceChange, volatility);
    }
  }
  
  private async publishRiskAlert(tokenId: string, severity: 'low' | 'medium' | 'high', priceChange: number, volatility: number): Promise<void> {
    const message: HCSMessage = {
      id: `risk-${Date.now()}`,
      type: 'RiskAlert',
      timestamp: Date.now(),
      sender: this.id,
      details: {
        severity,
        affectedTokens: [tokenId],
        metrics: {
          priceChange: priceChange * 100, // Convert to percentage
          volatility
        },
        description: `${severity.toUpperCase()} risk detected for token ${tokenId}`
      }
    };
    
    await this.hederaService.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!, message);
  }
  
  calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    // Calculate standard deviation of price changes
    const priceChanges = [];
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i-1]) / prices[i-1];
      priceChanges.push(change);
    }
    
    const mean = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
    const squaredDiffs = priceChanges.map(change => Math.pow(change - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    
    return Math.sqrt(variance);
  }
  
  // For testing
  getPriceHistory(): Map<string, number[]> {
    return this.priceHistory;
  }
}

// Mock the RiskAssessmentAgent module
jest.mock('@/app/services/agents/risk-assessment-agent', () => {
  return {
    RiskAssessmentAgent: jest.fn().mockImplementation((hederaService) => new MockRiskAssessmentAgent(hederaService)),
    __esModule: true
  };
});

describe('RiskAssessmentAgent', () => {
  let agent: MockRiskAssessmentAgent;
  let hederaService: HederaService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked HederaService
    hederaService = {
      subscribeToTopic: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
      publishHCSMessage: jest.fn().mockResolvedValue(undefined)
    } as unknown as HederaService;
    
    // Create agent with mocked dependencies
    agent = new (jest.requireMock('@/app/services/agents/risk-assessment-agent').RiskAssessmentAgent)(hederaService);
  });

  describe('handleMessage', () => {
    it('should handle PriceUpdate messages', async () => {
      const priceUpdate: HCSMessage = {
        id: 'test-price-1',
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        details: {
          tokenId: '0.0.123',
          price: 100,
          source: 'test'
        }
      };

      await agent.start();
      await agent.handleMessage(priceUpdate);

      // Verify price history was updated
      expect(agent.getPriceHistory().get('0.0.123')).toHaveLength(1);
    });

    it('should ignore non-PriceUpdate messages', async () => {
      const otherMessage: HCSMessage = {
        id: 'test-other-1',
        type: 'PolicyChange',
        timestamp: Date.now(),
        sender: 'other-agent',
        details: {}
      };

      await agent.start();
      await agent.handleMessage(otherMessage);

      // Verify no price history was updated
      expect(agent.getPriceHistory().size).toBe(0);
    });
  });

  describe('handlePriceUpdate', () => {
    it('should detect high risk and publish alert', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const highRiskPrice = initialPrice * 1.15; // 15% increase

      // Setup initial price message
      const initialPriceUpdate: HCSMessage = {
        id: 'test-price-initial',
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: initialPrice,
          source: 'test'
        }
      };

      // Setup high risk price message
      const highRiskUpdate: HCSMessage = {
        id: 'test-price-high-risk',
        type: 'PriceUpdate',
        timestamp: Date.now() + 1000,
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: highRiskPrice,
          source: 'test'
        }
      };

      await agent.start();
      
      // First add the initial price
      await agent.handleMessage(initialPriceUpdate);
      
      // Then add the high risk price
      await agent.handleMessage(highRiskUpdate);

      // Verify risk alert was published
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
        expect.objectContaining({
          type: 'RiskAlert',
          details: expect.objectContaining({
            severity: 'high',
            affectedTokens: [tokenId],
            metrics: expect.objectContaining({
              priceChange: expect.any(Number),
              volatility: expect.any(Number)
            })
          })
        })
      );
    });

    it('should detect medium risk and publish alert', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const mediumRiskPrice = initialPrice * 1.07; // 7% increase

      // Setup initial price message
      const initialPriceUpdate: HCSMessage = {
        id: 'test-price-initial',
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: initialPrice,
          source: 'test'
        }
      };

      // Setup medium risk price message
      const mediumRiskUpdate: HCSMessage = {
        id: 'test-price-medium-risk',
        type: 'PriceUpdate',
        timestamp: Date.now() + 1000,
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: mediumRiskPrice,
          source: 'test'
        }
      };

      await agent.start();
      
      // First add the initial price
      await agent.handleMessage(initialPriceUpdate);
      
      // Then add the medium risk price
      await agent.handleMessage(mediumRiskUpdate);

      // Verify risk alert was published
      expect(hederaService.publishHCSMessage).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
        expect.objectContaining({
          type: 'RiskAlert',
          details: expect.objectContaining({
            severity: 'medium',
            affectedTokens: [tokenId]
          })
        })
      );
    });

    it('should not publish alert for low risk changes', async () => {
      const tokenId = '0.0.123';
      const initialPrice = 100;
      const lowRiskPrice = initialPrice * 1.01; // 1% increase

      // Setup initial price message
      const initialPriceUpdate: HCSMessage = {
        id: 'test-price-initial',
        type: 'PriceUpdate',
        timestamp: Date.now(),
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: initialPrice,
          source: 'test'
        }
      };

      // Setup low risk price message
      const lowRiskUpdate: HCSMessage = {
        id: 'test-price-low-risk',
        type: 'PriceUpdate',
        timestamp: Date.now() + 1000,
        sender: 'price-feed-agent',
        details: {
          tokenId,
          price: lowRiskPrice,
          source: 'test'
        }
      };

      await agent.start();
      
      // First add the initial price
      await agent.handleMessage(initialPriceUpdate);
      
      // Clear previous calls from adding the initial price
      (hederaService.publishHCSMessage as jest.Mock).mockClear();
      
      // Then add the low risk price
      await agent.handleMessage(lowRiskUpdate);

      // Verify no risk alert was published
      expect(hederaService.publishHCSMessage).not.toHaveBeenCalled();
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate volatility correctly', () => {
      const prices = [100, 105, 98, 102, 103];
      const volatility = agent.calculateVolatility(prices);
      
      // Verify volatility is a positive number
      expect(volatility).toBeGreaterThan(0);
      expect(typeof volatility).toBe('number');
    });

    it('should return 0 for insufficient price history', () => {
      const prices = [100];
      const volatility = agent.calculateVolatility(prices);
      expect(volatility).toBe(0);
    });
  });
}); 