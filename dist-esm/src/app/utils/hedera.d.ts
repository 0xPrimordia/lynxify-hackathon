export interface TokenStats {
    marketCap: number;
    liquidity: number;
    volume24h: number;
}
export interface TokenLiquidityData {
    tokenId: string;
    volume24h: number;
    liquidityDepth: number;
    lastUpdated: Date;
}
export declare function getTokenMetadata(tokenId: string): Promise<{
    tokenId: any;
    symbol: any;
    name: any;
    decimals: any;
    totalSupply: any;
    maxSupply: any;
    treasury: any;
    supplyType: any;
    type: any;
    customFees: any;
    icon: null;
} | null>;
export declare function getTokenImageUrl(tokenId: string): null;
export declare function getTransactionsByTokenId(tokenId: string): Promise<any>;
export declare function getTokenBalancesByAccountId(accountId: string): Promise<any>;
export declare function getTokenStats(tokenId: string): Promise<TokenStats | null>;
export declare function getTokenLiquidity(tokenId: string): Promise<TokenLiquidityData | null>;
export declare function calculateTokenRatio(marketCap: number, liquidityData: TokenLiquidityData, totalMarketCap: number, minLiquidityThreshold: number): number;
