import { BaseAgent } from './base-agent';
import { HCSMessage, PriceUpdate } from '../../types/hcs';
import { HederaService } from '../hedera';

interface TokenPrice {
  tokenId: string;
  symbol: string;
  basePrice: number;
  volatility: number;
}

export class PriceFeedAgent extends BaseAgent {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly updateFrequency: number = 30000; // 30 seconds
  private readonly tokens: TokenPrice[] = [
    { tokenId: '0.0.1234567', symbol: 'BTC', basePrice: 50000, volatility: 0.02 },
    { tokenId: '0.0.1234568', symbol: 'ETH', basePrice: 3000, volatility: 0.03 },
    { tokenId: '0.0.1234569', symbol: 'USDC', basePrice: 1, volatility: 0.001 }
  ];

  constructor(hederaService: HederaService) {
    super({
      id: 'price-feed',
      type: 'price-feed',
      hederaService,
      topics: {
        input: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!,
        output: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID!
      }
    });
  }

  public async start(): Promise<void> {
    await super.start();
    this.startPriceUpdates();
  }

  public async stop(): Promise<void> {
    this.stopPriceUpdates();
    await super.stop();
  }

  private startPriceUpdates(): void {
    if (this.updateInterval) {
      return;
    }

    this.updateInterval = setInterval(async () => {
      try {
        // Simulate price updates for demo purposes
        for (const token of this.tokens) {
          const priceChange = (Math.random() - 0.5) * 2 * token.volatility;
          const newPrice = token.basePrice * (1 + priceChange);
          
          const priceUpdate: PriceUpdate = {
            id: `price-${Date.now()}-${token.symbol}`,
            type: 'PriceUpdate',
            timestamp: Date.now(),
            sender: this.id,
            details: {
              tokenId: token.tokenId,
              price: newPrice,
              source: 'simulated'
            }
          };

          await this.publishHCSMessage(priceUpdate);
        }
      } catch (error) {
        console.error('Error publishing price update:', error);
      }
    }, this.updateFrequency);
  }

  private stopPriceUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  protected async handleMessage(message: HCSMessage): Promise<void> {
    // Price feed agent doesn't need to handle incoming messages
    // It only publishes price updates
  }
} 