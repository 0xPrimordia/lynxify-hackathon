/**
 * Token Service for Lynxify Tokenized Index
 *
 * This service provides methods to interact with tokens via Hedera Token Service
 */
export declare enum TokenOperationType {
    CREATE = "CREATE",
    MINT = "MINT",
    BURN = "BURN"
}
export declare class TokenService {
    private client;
    private operatorId;
    private operatorKey;
    private tokenData;
    private tokenDataPath;
    constructor();
    /**
     * Loads token data from JSON file
     */
    private loadTokenData;
    private saveTokenData;
    /**
     * Get token ID by token symbol
     */
    getTokenId(tokenSymbol: string): string | null;
    /**
     * Get all token IDs
     */
    getAllTokenIds(): Record<string, string>;
    /**
     * Get token balances for all tokens
     */
    getTokenBalances(): Promise<Record<string, number>>;
    /**
     * Get token balance
     */
    getBalance(tokenId: string): Promise<number>;
    /**
     * Mint tokens for an asset
     */
    mintTokens(assetName: string, amount: number): Promise<boolean>;
    /**
     * Burn tokens for an asset
     */
    burnTokens(assetName: string, amount: number): Promise<boolean>;
    /**
     * Calculate required token adjustments to match new weights
     */
    calculateAdjustments(currentBalances: Record<string, number>, targetWeights: Record<string, number>): Record<string, number>;
    private logTransaction;
}
