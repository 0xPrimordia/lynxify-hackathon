import { TokenWeights } from '../../types/hcs';
interface MarketData {
    prices: Record<string, number>;
    priceChanges: Record<string, number>;
    volumes: Record<string, number>;
    volatility: Record<string, number>;
    correlations?: Record<string, Record<string, number>>;
}
interface TokenHolding {
    amount: number;
    value: number;
    weight: number;
}
interface Treasury {
    totalValue: number;
    holdings: Record<string, TokenHolding>;
}
interface RebalanceResult {
    success: boolean;
    message?: string;
    newWeights?: TokenWeights;
    analysis?: string;
}
export declare class AIRebalanceAgent {
    private openai;
    private supportedTokens;
    private lastRebalanceTime;
    private rebalanceIntervalHours;
    private marketData;
    private treasuryState;
    constructor();
    updateMarketData(data: Partial<MarketData>): Promise<void>;
    updateTreasuryState(treasury: Treasury): Promise<void>;
    generateRebalanceProposal(): Promise<RebalanceResult>;
    private generatePortfolioAllocation;
    private analyzeProposedChanges;
    private submitRebalanceProposal;
    checkAndGenerateRebalance(): Promise<boolean>;
}
export declare const aiRebalanceAgent: AIRebalanceAgent;
export {};
