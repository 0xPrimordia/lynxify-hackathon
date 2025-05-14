export interface HCSMessage {
    id: string;
    type: 'PriceUpdate' | 'RiskAlert' | 'RebalanceProposal' | 'RebalanceApproved' | 'RebalanceExecuted' | 'PolicyChange' | 'AgentResponse' | 'AgentRequest' | 'AgentInfo';
    timestamp: number;
    sender: string;
    details: {
        message?: string;
        impact?: string;
        tokenId?: string;
        price?: number;
        source?: string;
        severity?: 'low' | 'medium' | 'high';
        description?: string;
        affectedTokens?: string[];
        metrics?: {
            volatility?: number;
            volume?: number;
            priceChange?: number;
        };
        trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled';
        deviation?: number;
        riskLevel?: string;
        newWeights?: Record<string, number>;
        executeAfter?: number;
        quorum?: number;
        proposalId?: string;
        approvedAt?: number;
        preBalances?: Record<string, number>;
        postBalances?: Record<string, number>;
        executedAt?: number;
        policyId?: string;
        changes?: {
            maxWeight?: number;
            minLiquidity?: number;
            stopLossThreshold?: number;
            rebalanceThreshold?: number;
        };
        effectiveFrom?: number;
        testId?: string;
        originalMessageId?: string;
        rebalancerStatus?: string;
        request?: string;
        agentId?: string;
    };
    votes?: {
        for: number;
        against: number;
        total: number;
    };
}
export interface TokenWeights {
    [tokenId: string]: number;
}
export declare function isValidHCSMessage(message: any): message is HCSMessage;
export declare function isRebalanceProposal(message: HCSMessage): message is HCSMessage & {
    type: 'RebalanceProposal';
};
export declare function isRiskAlert(message: HCSMessage): message is HCSMessage & {
    type: 'RiskAlert';
};
export declare function isPolicyChange(message: HCSMessage): message is HCSMessage & {
    type: 'PolicyChange';
};
export type SDKCallback = (message: any) => void;
