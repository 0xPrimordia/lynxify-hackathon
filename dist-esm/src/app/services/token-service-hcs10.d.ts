import { TokenService } from './token-service.js';
/**
 * Enhanced TokenService for HCS-10 Integration
 * Extends the base TokenService with additional methods needed for the HCS-10 implementation
 */
export declare class TokenServiceHCS10 {
    private tokenService;
    private logger;
    constructor(tokenService: TokenService);
    /**
     * Get current balances for all tokens
     * Wrapper for getTokenBalances in the base TokenService
     */
    getCurrentBalances(): Promise<Record<string, number>>;
    /**
     * Execute a rebalance operation based on target weights
     * @param targetWeights Record of token symbols to target weights (0-1)
     */
    rebalance(targetWeights: Record<string, number>): Promise<boolean>;
    /**
     * Get token ID by symbol
     * @param symbol The token symbol
     */
    getTokenId(symbol: string): string | null;
    /**
     * Get all token IDs
     */
    getAllTokenIds(): Record<string, string>;
    /**
     * Get balance for a specific token
     * @param tokenId The token ID
     */
    getBalance(tokenId: string): Promise<number>;
}
export declare function createTokenServiceHCS10(tokenService: TokenService): TokenServiceHCS10;
