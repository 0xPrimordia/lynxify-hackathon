import { HCSMessage } from '../types/hcs';
/**
 * AI Analysis Service
 * Uses OpenAI to analyze rebalance proposals and generate insights
 */
export declare class AIAnalysisService {
    private openai;
    /**
     * Initialize the AI Analysis Service
     * @param apiKey OpenAI API key
     */
    constructor(apiKey: string);
    /**
     * Analyze a rebalance proposal using OpenAI
     * @param proposal The rebalance proposal message
     * @returns Analysis of the proposal as a string
     */
    analyzeRebalanceProposal(proposal: HCSMessage): Promise<string>;
    /**
     * Generate a summary of a rebalance execution
     * @param preBalances Previous token balances
     * @param postBalances New token balances after rebalance
     * @returns Summary of the rebalance execution
     */
    generateRebalanceSummary(preBalances: Record<string, number | string>, postBalances: Record<string, number | string>): Promise<string>;
}
declare const aiAnalysis: AIAnalysisService | null;
export default aiAnalysis;
