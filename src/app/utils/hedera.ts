const MIRROR_NODE_URL = 'https://mainnet.mirrornode.hedera.com';
const SAUCERSWAP_API = 'https://api.saucerswap.finance/api/v1';

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

function formatTokenIdForMirrorNode(tokenId: string): string {
    // Remove dots and convert to raw format (e.g., '0.0.123' becomes '123')
    return tokenId.split('.').pop() || tokenId;
}

export async function getTokenMetadata(tokenId: string) {
    try {
        const response = await fetch(`${MIRROR_NODE_URL}/api/v1/tokens/${tokenId}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch token metadata: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
            tokenId: data.token_id,
            symbol: data.symbol,
            name: data.name,
            decimals: data.decimals,
            totalSupply: data.total_supply,
            maxSupply: data.max_supply,
            treasury: data.treasury_account_id,
            supplyType: data.supply_type,
            type: data.type,
            customFees: data.custom_fees,
            icon: null as null
        };
    } catch (error) {
        console.error(`Error fetching metadata for token ${tokenId}:`, error);
        return null;
    }
}

export function getTokenImageUrl(tokenId: string): null {
    // Note: Mirror Node doesn't provide token logos directly
    // This is a placeholder that should be removed or replaced with an alternative source
    return null;
}

export async function getTransactionsByTokenId(tokenId: string) {
    try {
        const formattedTokenId = formatTokenIdForMirrorNode(tokenId);
        const response = await fetch(`${MIRROR_NODE_URL}/api/v1/tokens/${formattedTokenId}/transactions`, {
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch token transactions: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.transactions;
    } catch (error) {
        console.error(`Error fetching transactions for token ${tokenId}:`, error);
        return null;
    }
}

export async function getTokenBalancesByAccountId(accountId: string) {
    try {
        const formattedAccountId = formatTokenIdForMirrorNode(accountId);
        const response = await fetch(`${MIRROR_NODE_URL}/api/v1/accounts/${formattedAccountId}/tokens`, {
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch account token balances: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.tokens;
    } catch (error) {
        console.error(`Error fetching token balances for account ${accountId}:`, error);
        return null;
    }
}

async function getSaucerSwapStats(tokenId: string): Promise<{ tvlUSD: number; volume24h: number; priceUSD: number } | null> {
    try {
        // Format tokenId to match SaucerSwap's format (0.0.xxx)
        const formattedTokenId = tokenId.startsWith('0.0.') ? tokenId : `0.0.${tokenId}`;

        // Get token statistics
        const tokenResponse = await fetch(`${SAUCERSWAP_API}/tokens`);
        if (!tokenResponse.ok) {
            console.error('Failed to fetch token stats from SaucerSwap');
            return null;
        }
        const tokensData = await tokenResponse.json();
        
        // Find our token in the response using formatted ID
        const tokenData = tokensData.find((token: any) => token.id === formattedTokenId);
        if (!tokenData) {
            console.error(`Token ${formattedTokenId} not found in SaucerSwap`);
            return null;
        }

        // Get pools information
        const poolsResponse = await fetch(`${SAUCERSWAP_API}/pools`);
        if (!poolsResponse.ok) {
            console.error('Failed to fetch pools from SaucerSwap');
            return null;
        }
        const poolsData = await poolsResponse.json();

        // Filter pools using formatted token ID
        const relevantPools = poolsData.filter((pool: any) => 
            pool.token0.id === formattedTokenId || pool.token1.id === formattedTokenId
        );

        // Calculate totals using SaucerSwap's field names
        const tvlUSD = relevantPools.reduce((sum: number, pool: any) => 
            sum + Number(pool.tvl || 0), 0);
        const volume24h = relevantPools.reduce((sum: number, pool: any) => 
            sum + Number(pool.volume24H || 0), 0);

        return {
            tvlUSD,
            volume24h,
            priceUSD: Number(tokenData.price || 0),
        };
    } catch (error) {
        console.error('Error fetching SaucerSwap stats:', error);
        return null;
    }
}

export async function getTokenStats(tokenId: string): Promise<TokenStats | null> {
    try {
        const saucerStats = await getSaucerSwapStats(tokenId);
        if (!saucerStats) return null;

        const { tvlUSD, volume24h, priceUSD } = saucerStats;

        // Mirror node call to get total supply
        const formattedTokenId = formatTokenIdForMirrorNode(tokenId);
        const response = await fetch(`${MIRROR_NODE_URL}/api/v1/tokens/${formattedTokenId}`, {
            headers: {
                'Accept': 'application/json',
            }
        });
        const tokenData = await response.json();
        const totalSupply = Number(tokenData.total_supply) / Math.pow(10, tokenData.decimals);

        // Calculate market cap using price and total supply
        const marketCap = totalSupply * priceUSD;

        return {
            marketCap,
            liquidity: tvlUSD,
            volume24h,
        };
    } catch (error) {
        console.error(`Error fetching token stats for ${tokenId}:`, error);
        return null;
    }
}

export async function getTokenLiquidity(tokenId: string): Promise<TokenLiquidityData | null> {
    try {
        const saucerStats = await getSaucerSwapStats(tokenId);
        if (!saucerStats) return null;

        return {
            tokenId,
            volume24h: saucerStats.volume24h,
            liquidityDepth: saucerStats.tvlUSD,
            lastUpdated: new Date()
        };
    } catch (error) {
        console.error(`Error fetching token liquidity for ${tokenId}:`, error);
        return null;
    }
}

export function calculateTokenRatio(
    marketCap: number,
    liquidityData: TokenLiquidityData,
    totalMarketCap: number,
    minLiquidityThreshold: number
): number {
    // If liquidity is below threshold, reduce the weight
    const liquidityRatio = liquidityData.liquidityDepth / marketCap;
    const liquidityMultiplier = liquidityRatio < minLiquidityThreshold ? 0.5 : 1;

    // Base weight from market cap
    const baseWeight = (marketCap / totalMarketCap) * 100;

    // Adjusted weight considering liquidity
    return baseWeight * liquidityMultiplier;
}