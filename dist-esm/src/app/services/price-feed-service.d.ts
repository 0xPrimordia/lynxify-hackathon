import { SharedHederaService } from './shared-hedera-service';
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
 * Service for managing price feeds
 */
export declare class PriceFeedService {
    private hederaService;
    private config;
    private eventBus;
    private providers;
    private priceHistory;
    private latestPrices;
    private updateInterval;
    private initialized;
    constructor(hederaService: SharedHederaService, config?: PriceFeedConfig);
    /**
     * Set up price data providers
     */
    private setupProviders;
    /**
     * Initialize the price feed service
     */
    initialize(): Promise<void>;
    /**
     * Update prices for all tokens
     */
    private updateAllPrices;
    /**
     * Fetch current price for a token using available providers
     */
    private fetchTokenPrice;
    /**
     * Broadcast a price update to the Hedera network
     */
    private broadcastPriceUpdate;
    /**
     * Get the latest price for a token
     */
    getLatestPrice(symbol: string): TokenPrice | null;
    /**
     * Get all latest prices
     */
    getAllLatestPrices(): Record<string, TokenPrice>;
    /**
     * Get price history for a token
     */
    getPriceHistory(symbol: string): TokenPrice[];
    /**
     * Check if the service is initialized
     */
    isInitialized(): boolean;
    /**
     * Clean up resources
     */
    cleanup(): void;
}
