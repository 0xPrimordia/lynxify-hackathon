import { Sector, Token } from '../data/tokens';
interface TokenWeight {
    token: Token;
    weight: number;
    liquidityScore: number;
}
interface SectorComposition {
    sector: string;
    weights: TokenWeight[];
    totalWeight: number;
}
export declare function calculateOptimalComposition(sectors: Sector[], minLiquidityThreshold?: number): Promise<SectorComposition[]>;
export declare function isRebalancingNeeded(currentWeights: TokenWeight[], targetWeights: TokenWeight[], driftThreshold?: number): boolean;
export {};
