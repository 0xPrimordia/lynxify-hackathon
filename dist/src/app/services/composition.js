import { getTokenLiquidity, calculateTokenRatio } from '../utils/hedera';
export async function calculateOptimalComposition(sectors, minLiquidityThreshold = 0.1 // 10% liquidity to market cap ratio as default
) {
    const composition = [];
    for (const sector of sectors) {
        const weights = [];
        let sectorMarketCap = 0;
        // First pass: gather liquidity data and calculate total market cap
        for (const token of sector.tokens) {
            if (!token.tokenId)
                continue;
            const liquidityData = await getTokenLiquidity(token.tokenId);
            if (!liquidityData)
                continue;
            // For prototype: using liquidityDepth as a proxy for market cap
            // In production: would fetch real market cap data from reliable sources
            const mockMarketCap = liquidityData.liquidityDepth * 3; // Example multiplier
            sectorMarketCap += mockMarketCap;
            weights.push({
                token,
                weight: 0, // Will be calculated in second pass
                liquidityScore: liquidityData.liquidityDepth / mockMarketCap
            });
        }
        // Second pass: calculate actual weights considering liquidity
        for (const weight of weights) {
            const tokenWeight = calculateTokenRatio(sectorMarketCap / weights.length, // Simplified market cap distribution
            {
                tokenId: weight.token.tokenId,
                volume24h: 0, // Not used in this calculation
                liquidityDepth: weight.liquidityScore * sectorMarketCap,
                lastUpdated: new Date()
            }, sectorMarketCap, minLiquidityThreshold);
            weight.weight = tokenWeight;
        }
        // Normalize weights to ensure they sum to sector's total weight
        const totalCalculatedWeight = weights.reduce((sum, w) => sum + w.weight, 0);
        const normalizer = sector.weight / totalCalculatedWeight;
        weights.forEach(w => {
            w.weight *= normalizer;
        });
        composition.push({
            sector: sector.name,
            weights,
            totalWeight: sector.weight
        });
    }
    return composition;
}
// Function to check if rebalancing is needed based on weight drift
export function isRebalancingNeeded(currentWeights, targetWeights, driftThreshold = 5 // 5% drift threshold by default
) {
    for (const current of currentWeights) {
        const target = targetWeights.find(t => t.token.tokenId === current.token.tokenId);
        if (!target)
            continue;
        const drift = Math.abs(current.weight - target.weight);
        if (drift > driftThreshold) {
            return true;
        }
    }
    return false;
}
