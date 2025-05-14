interface MarketData {
    token: string;
    price: number;
    volume24h: number;
    liquidityDepth: number;
    lastUpdated: number;
}
interface RebalanceDecision {
    token: string;
    targetWeight: number;
    reason: string;
}
export declare class AIService {
    private openai;
    constructor();
    analyzeMarketAndDecideRebalance(currentWeights: Record<string, number>, marketData: MarketData[]): Promise<RebalanceDecision[]>;
    private buildAnalysisPrompt;
    private parseAIResponse;
}
export {};
