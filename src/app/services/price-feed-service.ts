import { EventBus, EventType } from '../utils/event-emitter';
import { SharedHederaService } from './shared-hedera-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Price data provider interface
 */
export interface PriceProvider {
  name: string;
  getPrice(tokenSymbol: string): Promise<number | null>;
  isAvailable(): Promise<boolean>;
}

/**
 * Token price information
 */
export interface TokenPrice {
  symbol: string;
  tokenId: string;
  price: number;
  timestamp: number;
  change24h?: number;
  changePercent24h?: number;
  source: string;
}

/**
 * Price feed configuration
 */
export interface PriceFeedConfig {
  outputTopicId: string;
  tokenIds: Record<string, string>;
  updateFrequencyMs?: number;
  simulationMode?: boolean;
  simulationConfig?: {
    volatility?: Record<string, number>;
    basePrices?: Record<string, number>;
  };
  maxHistoryLength?: number;
}

/**
 * Simulated price provider for development and testing
 */
class SimulatedPriceProvider implements PriceProvider {
  private basePrices: Record<string, number>;
  private volatility: Record<string, number>;
  
  constructor(basePrices?: Record<string, number>, volatility?: Record<string, number>) {
    // Default base prices for common tokens
    this.basePrices = basePrices || {
      'BTC': 50000,
      'ETH': 3000,
      'SOL': 100,
      'HBAR': 0.1,
      'USDC': 1,
      'LYNX': 5
    };
    
    // Default volatility settings
    this.volatility = volatility || {
      'BTC': 0.02,  // 2% volatility
      'ETH': 0.025, // 2.5% volatility
      'SOL': 0.035, // 3.5% volatility
      'HBAR': 0.03, // 3% volatility
      'USDC': 0.001, // 0.1% volatility (stablecoin)
      'LYNX': 0.015 // 1.5% volatility
    };
  }
  
  public async getPrice(tokenSymbol: string): Promise<number | null> {
    const symbol = tokenSymbol.toUpperCase();
    const basePrice = this.basePrices[symbol];
    
    if (basePrice === undefined) {
      return null;
    }
    
    const tokenVolatility = this.volatility[symbol] || 0.01;
    const priceChange = (Math.random() - 0.5) * 2 * tokenVolatility;
    
    return basePrice * (1 + priceChange);
  }
  
  public async isAvailable(): Promise<boolean> {
    return true; // Simulation is always available
  }
  
  public get name(): string {
    return 'SimulatedPriceProvider';
  }
}

/**
 * External API price provider (can be extended for real providers)
 */
class ExternalApiPriceProvider implements PriceProvider {
  private apiEndpoint: string;
  private apiKey?: string;
  private cache: Record<string, { price: number; timestamp: number }> = {};
  private cacheTimeMs = 60000; // 1 minute cache
  
  constructor(apiEndpoint: string, apiKey?: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }
  
  public async getPrice(tokenSymbol: string): Promise<number | null> {
    const symbol = tokenSymbol.toUpperCase();
    
    // Check cache first
    const cached = this.cache[symbol];
    if (cached && Date.now() - cached.timestamp < this.cacheTimeMs) {
      return cached.price;
    }
    
    try {
      // In a real implementation, this would make an API call
      // For demo purposes, fall back to simulation
      const simulator = new SimulatedPriceProvider();
      const price = await simulator.getPrice(symbol);
      
      if (price !== null) {
        this.cache[symbol] = {
          price,
          timestamp: Date.now()
        };
      }
      
      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      return null;
    }
  }
  
  public async isAvailable(): Promise<boolean> {
    try {
      // In a real implementation, check API availability
      return true;
    } catch (error) {
      return false;
    }
  }
  
  public get name(): string {
    return 'ExternalApiPriceProvider';
  }
}

/**
 * Service for managing price feeds
 */
export class PriceFeedService {
  private hederaService: SharedHederaService;
  private config: PriceFeedConfig;
  private eventBus = EventBus.getInstance();
  
  private providers: PriceProvider[] = [];
  private priceHistory: Record<string, TokenPrice[]> = {};
  private latestPrices: Record<string, TokenPrice> = {};
  
  private updateInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  
  constructor(hederaService: SharedHederaService, config?: PriceFeedConfig) {
    this.hederaService = hederaService;
    
    // Use default config in test environment if not provided
    if (!config && process.env.NODE_ENV === 'test') {
      this.config = {
        outputTopicId: 'test-price-feed-topic',
        tokenIds: {
          'BTC': '0.0.1001',
          'ETH': '0.0.1002',
          'SOL': '0.0.1003'
        }
      };
    } else if (!config) {
      throw new Error('PriceFeedConfig is required for non-test environments');
    } else {
      this.config = config;
    }
    
    // Set up providers
    this.setupProviders();
  }
  
  /**
   * Set up price data providers
   */
  private setupProviders(): void {
    // Always add simulated provider as fallback
    this.providers.push(
      new SimulatedPriceProvider(
        this.config.simulationConfig?.basePrices,
        this.config.simulationConfig?.volatility
      )
    );
    
    // Add external API provider if not in simulation mode
    if (!this.config.simulationMode) {
      // In a real implementation, add API key from config
      this.providers.push(
        new ExternalApiPriceProvider('https://api.example.com/prices')
      );
    }
  }
  
  /**
   * Initialize the price feed service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      console.log('🔄 Initializing PriceFeedService...');
      
      // Initial price update
      await this.updateAllPrices();
      
      // Set up regular interval for price updates
      this.updateInterval = setInterval(
        () => this.updateAllPrices(), 
        this.config.updateFrequencyMs
      );
      
      // Set up event listener for shutdown
      this.eventBus.onEvent(EventType.SYSTEM_SHUTDOWN, () => {
        this.cleanup();
      });
      
      this.initialized = true;
      console.log('✅ PriceFeedService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PriceFeedService:', error);
      throw error;
    }
  }
  
  /**
   * Update prices for all tokens
   */
  private async updateAllPrices(): Promise<void> {
    try {
      console.log('🔄 Updating all token prices...');
      
      const allSymbols = Object.keys(this.config.tokenIds);
      const updates: TokenPrice[] = [];
      
      for (const symbol of allSymbols) {
        const price = await this.fetchTokenPrice(symbol);
        
        if (price) {
          updates.push(price);
          
          // Store in latest prices
          this.latestPrices[symbol] = price;
          
          // Add to price history
          if (!this.priceHistory[symbol]) {
            this.priceHistory[symbol] = [];
          }
          
          this.priceHistory[symbol].push(price);
          
          // Trim history if needed
          if (this.priceHistory[symbol].length > this.config.maxHistoryLength!) {
            this.priceHistory[symbol].shift();
          }
          
          // Calculate 24h change if we have enough history
          if (this.priceHistory[symbol].length > 1) {
            const oldestIndex = Math.max(0, this.priceHistory[symbol].length - 24);
            const oldPrice = this.priceHistory[symbol][oldestIndex].price;
            const change = price.price - oldPrice;
            const changePercent = oldPrice !== 0 ? (change / oldPrice) * 100 : 0;
            
            price.change24h = change;
            price.changePercent24h = changePercent;
          }
          
          // Broadcast the price update
          await this.broadcastPriceUpdate(price);
        }
      }
      
      if (updates.length > 0) {
        console.log(`✅ Updated prices for ${updates.length} tokens`);
      } else {
        console.warn('⚠️ Failed to update any token prices');
      }
    } catch (error) {
      console.error('❌ Error updating token prices:', error);
    }
  }
  
  /**
   * Fetch current price for a token using available providers
   */
  private async fetchTokenPrice(symbol: string): Promise<TokenPrice | null> {
    const tokenId = this.config.tokenIds[symbol];
    
    if (!tokenId) {
      console.warn(`⚠️ No token ID mapping for symbol: ${symbol}`);
      return null;
    }
    
    // Try each provider in order until we get a price
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          const price = await provider.getPrice(symbol);
          
          if (price !== null) {
            return {
              symbol,
              tokenId,
              price,
              timestamp: Date.now(),
              source: provider.name
            };
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching price from ${provider.name}:`, error);
      }
    }
    
    console.warn(`⚠️ Failed to get price for ${symbol} from any provider`);
    return null;
  }
  
  /**
   * Broadcast a price update to the Hedera network
   */
  private async broadcastPriceUpdate(priceInfo: TokenPrice): Promise<void> {
    const priceMessage = {
      id: uuidv4(),
      type: 'PriceUpdate',
      timestamp: Date.now(),
      sender: 'price-feed-service',
      details: {
        tokenId: priceInfo.tokenId,
        symbol: priceInfo.symbol,
        price: priceInfo.price,
        change24h: priceInfo.change24h,
        changePercent24h: priceInfo.changePercent24h,
        source: priceInfo.source
      }
    };
    
    try {
      // Send to Hedera topic
      await this.hederaService.sendMessage(this.config.outputTopicId, priceMessage);
      
      // Emit local event
      this.eventBus.emitEvent(EventType.INDEX_PRICE_UPDATED, {
        tokenId: priceInfo.tokenId,
        price: priceInfo.price,
        source: priceInfo.source
      });
      
      console.log(`📤 Broadcast price update for ${priceInfo.symbol}: ${priceInfo.price}`);
    } catch (error) {
      console.error(`❌ Failed to broadcast price update for ${priceInfo.symbol}:`, error);
    }
  }
  
  /**
   * Get the latest price for a token
   */
  public getLatestPrice(symbol: string): TokenPrice | null {
    return this.latestPrices[symbol] || null;
  }
  
  /**
   * Get all latest prices
   */
  public getAllLatestPrices(): Record<string, TokenPrice> {
    return { ...this.latestPrices };
  }
  
  /**
   * Get price history for a token
   */
  public getPriceHistory(symbol: string): TokenPrice[] {
    return this.priceHistory[symbol] ? [...this.priceHistory[symbol]] : [];
  }
  
  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
} 