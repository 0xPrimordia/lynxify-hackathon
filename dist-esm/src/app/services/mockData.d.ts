import { Proposal } from '../types/hedera';
export declare const mockProposals: Proposal[];
export declare const mockHCSMessages: ({
    id: string;
    type: string;
    timestamp: number;
    tokenId: string;
    price: number;
    priceChange: number;
    sender: string;
    riskLevel?: undefined;
    affectedTokens?: undefined;
    trigger?: undefined;
    details?: undefined;
} | {
    id: string;
    type: string;
    timestamp: number;
    riskLevel: string;
    affectedTokens: string[];
    trigger: string;
    sender: string;
    details: {
        message: string;
        impact: string;
        trigger?: undefined;
        deviation?: undefined;
        newWeights?: undefined;
        proposalId?: undefined;
        approvedAt?: undefined;
        executedAt?: undefined;
        preBalances?: undefined;
        postBalances?: undefined;
    };
    tokenId?: undefined;
    price?: undefined;
    priceChange?: undefined;
} | {
    id: string;
    type: string;
    timestamp: number;
    sender: string;
    details: {
        trigger: string;
        deviation: number;
        newWeights: {
            BTC: number;
            ETH: number;
            USDC: number;
        };
        message?: undefined;
        impact?: undefined;
        proposalId?: undefined;
        approvedAt?: undefined;
        executedAt?: undefined;
        preBalances?: undefined;
        postBalances?: undefined;
    };
    tokenId?: undefined;
    price?: undefined;
    priceChange?: undefined;
    riskLevel?: undefined;
    affectedTokens?: undefined;
    trigger?: undefined;
} | {
    id: string;
    type: string;
    timestamp: number;
    sender: string;
    details: {
        proposalId: string;
        approvedAt: number;
        message?: undefined;
        impact?: undefined;
        trigger?: undefined;
        deviation?: undefined;
        newWeights?: undefined;
        executedAt?: undefined;
        preBalances?: undefined;
        postBalances?: undefined;
    };
    tokenId?: undefined;
    price?: undefined;
    priceChange?: undefined;
    riskLevel?: undefined;
    affectedTokens?: undefined;
    trigger?: undefined;
} | {
    id: string;
    type: string;
    timestamp: number;
    sender: string;
    details: {
        proposalId: string;
        executedAt: number;
        preBalances: {
            BTC: number;
            ETH: number;
            USDC: number;
        };
        postBalances: {
            BTC: number;
            ETH: number;
            USDC: number;
        };
        message?: undefined;
        impact?: undefined;
        trigger?: undefined;
        deviation?: undefined;
        newWeights?: undefined;
        approvedAt?: undefined;
    };
    tokenId?: undefined;
    price?: undefined;
    priceChange?: undefined;
    riskLevel?: undefined;
    affectedTokens?: undefined;
    trigger?: undefined;
})[];
