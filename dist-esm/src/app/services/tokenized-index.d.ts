import { SharedHederaService } from './shared-hedera-service';
import { TokenService } from './token-service';
import { PriceFeedService } from './price-feed-service';
/**
 * Configuration for the Tokenized Index Service
 */
export interface TokenizedIndexConfig {
    indexTopicId: string;
    proposalTimeoutMs?: number;
    rebalanceThreshold?: number;
    riskThreshold?: number;
}
/**
 * Rebalance Proposal structure
 */
interface RebalanceProposal {
    id: string;
    newWeights: Record<string, number>;
    trigger: 'price_deviation' | 'risk_threshold' | 'scheduled';
    timestamp: number;
    expiration: number;
    approved: boolean;
    executed: boolean;
    votes: {
        for: number;
        against: number;
        total: number;
    };
}
/**
 * Risk metrics for a token
 */
interface TokenRiskMetrics {
    volatility: number;
    drawdown: number;
    sharpeRatio?: number;
    correlations: Record<string, number>;
    lastUpdated: number;
    historicalPrices?: number[];
}
/**
 * Portfolio risk metrics
 */
interface PortfolioRiskMetrics {
    totalVolatility: number;
    diversificationScore: number;
    concentrationRisk: number;
    marketRisk: number;
    timestamp: number;
    highRiskTokens: string[];
}
/**
 * Service that handles tokenized index business logic
 */
export declare class TokenizedIndexService {
    private readonly eventBus;
    private readonly hederaService;
    private readonly tokenService;
    private readonly priceFeedService;
    private readonly config;
    private currentWeights;
    private tokenPrices;
    private activeProposals;
    private executedProposals;
    private initialized;
    private tokenRiskMetrics;
    private portfolioRiskMetrics?;
    private priceHistory;
    private riskAssessmentInterval;
    /**
     * Create a new TokenizedIndexService
     */
    constructor(hederaService: SharedHederaService, config: TokenizedIndexConfig, tokenService?: TokenService, priceFeedService?: PriceFeedService, testingMode?: boolean);
    /**
     * Set up event handlers for this service
     */
    private setupEventHandlers;
    /**
     * Update token price (called from price feed events)
     */
    private updateTokenPrice;
    /**
     * Process messages from the index topic
     */
    private processIndexMessage;
    /**
     * Handle a risk alert message
     */
    private handleRiskAlert;
    /**
     * Handle a rebalance proposal message
     */
    private handleRebalanceProposal;
    /**
     * Handle a rebalance approved message
     */
    private handleRebalanceApproved;
    /**
     * Handle a rebalance executed message
     */
    private handleRebalanceExecuted;
    /**
     * Handle a policy change message
     */
    private handlePolicyChange;
    /**
     * Check price deviations to see if a rebalance should be triggered
     */
    private checkPriceDeviationThreshold;
    /**
     * Propose a rebalance based on risk analysis
     */
    private proposeRiskBasedRebalance;
    /**
     * Propose a rebalance with auto-calculated weights
     */
    private proposeRebalance;
    /**
     * Propose a rebalance with specific weights
     */
    private proposeRebalanceWithWeights;
    /**
     * Execute a rebalance based on an approved proposal
     */
    private executeRebalance;
    /**
     * Check for expired proposals
     */
    private checkProposalExpirations;
    /**
     * Calculate risk metrics for a specific token
     */
    private updateTokenRiskMetrics;
    /**
     * Calculate correlation between two tokens
     */
    private calculateCorrelation;
    /**
     * Perform a comprehensive risk assessment of the entire portfolio
     */
    private assessPortfolioRisk;
    /**
     * Check if portfolio risk exceeds defined thresholds
     */
    private checkRiskThresholds;
    /**
     * Initialize the service
     */
    initialize(): Promise<void>;
    /**
     * Synchronize token prices from price feed service
     */
    private syncPricesFromFeed;
    /**
     * Load initial state for the service
     */
    private loadInitialState;
    /**
     * Initialize default weights for demonstration
     */
    private initializeDefaultWeights;
    /**
     * Get current token weights
     */
    getCurrentWeights(): Record<string, number>;
    /**
     * Get current token prices
     */
    getTokenPrices(): Record<string, {
        price: number;
        timestamp: number;
        source: string;
    }>;
    /**
     * Get active proposals
     */
    getActiveProposals(): Map<string, RebalanceProposal>;
    /**
     * Get service config
     */
    getConfig(): TokenizedIndexConfig;
    /**
     * Check if the service is initialized
     */
    isInitialized(): boolean;
    /**
     * Clean up resources when shutting down
     */
    shutdown(): Promise<void>;
    /**
     * Disable risk assessment timer (useful for testing)
     * @internal This method is intended for testing purposes only
     */
    disableRiskAssessmentTimer(): void;
    /**
     * Legacy cleanup method kept for backward compatibility
     * @deprecated Use shutdown() instead
     */
    cleanup(): void;
    /**
     * Get the current risk metrics for the portfolio
     */
    getPortfolioRiskMetrics(): PortfolioRiskMetrics | undefined;
    /**
     * Get risk metrics for a specific token
     */
    getTokenRiskMetrics(tokenId: string): TokenRiskMetrics | undefined;
    /**
     * Get all token risk metrics
     */
    getAllTokenRiskMetrics(): Record<string, TokenRiskMetrics>;
}
export {};
