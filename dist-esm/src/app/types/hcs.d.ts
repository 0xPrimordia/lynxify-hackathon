export interface HCSMessage {
    id: string;
    type: 'PriceUpdate' | 'RiskAlert' | 'RebalanceProposal' | 'RebalanceApproved' | 'RebalanceExecuted' | 'PolicyChange' | 'AgentInfo' | 'AgentResponse' | 'AgentRequest';
    timestamp: number;
    sender: string;
    details: {
        message?: string;
        impact?: string;
        tokenId?: string;
        price?: number;
        source?: string;
        severity?: 'low' | 'medium' | 'high';
        riskDescription?: string;
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
        originalMessageId?: string;
        rebalancerStatus?: string;
        agentId?: string;
        request?: string;
        analysis?: string;
        capabilities?: string[];
        agentDescription?: string;
        pendingProposals?: number;
        executedProposals?: number;
    };
    votes?: {
        for: number;
        against: number;
        total: number;
    };
}
export interface PriceUpdate extends HCSMessage {
    type: 'PriceUpdate';
    details: {
        tokenId: string;
        price: number;
        source?: string;
        message?: string;
    };
}
export interface RiskAlert extends HCSMessage {
    type: 'RiskAlert';
    details: {
        severity: 'low' | 'medium' | 'high';
        riskDescription: string;
        affectedTokens?: string[];
        metrics?: {
            volatility?: number;
            volume?: number;
            priceChange?: number;
        };
        message?: string;
    };
}
export interface RebalanceProposal extends HCSMessage {
    type: 'RebalanceProposal';
    details: {
        proposalId: string;
        newWeights: Record<string, number>;
        executeAfter?: number;
        quorum?: number;
        trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled';
        message?: string;
    };
}
export interface RebalanceApproved extends HCSMessage {
    type: 'RebalanceApproved';
    details: {
        proposalId: string;
        approvedAt: number;
        message?: string;
    };
}
export interface RebalanceExecuted extends HCSMessage {
    type: 'RebalanceExecuted';
    details: {
        proposalId: string;
        preBalances: Record<string, number>;
        postBalances: Record<string, number>;
        executedAt: number;
        message?: string;
    };
}
export interface PolicyChange extends HCSMessage {
    type: 'PolicyChange';
    details: {
        policyId: string;
        changes: {
            maxWeight?: number;
            minLiquidity?: number;
            stopLossThreshold?: number;
            rebalanceThreshold?: number;
        };
        effectiveFrom?: number;
        message?: string;
    };
}
export interface TokenWeights {
    [tokenId: string]: number;
}
export declare function isValidHCSMessage(message: any): message is HCSMessage;
export declare function isRebalanceProposal(message: HCSMessage | null | undefined): message is RebalanceProposal;
export declare function isRebalanceApproved(message: HCSMessage | null | undefined): message is RebalanceApproved;
export declare function isRebalanceExecuted(message: HCSMessage | null | undefined): message is RebalanceExecuted;
export declare function isPriceUpdate(message: HCSMessage | null | undefined): message is PriceUpdate;
export declare function isRiskAlert(message: HCSMessage | null | undefined): message is RiskAlert;
export declare function isPolicyChange(message: HCSMessage | null | undefined): message is PolicyChange;
export declare function isMoonscapeMessage(message: HCSMessage | null | undefined): message is HCSMessage & {
    type: 'AgentInfo' | 'AgentResponse' | 'AgentRequest';
};
export type SDKCallback = (message: {
    message: string;
    sequence_number: number;
}) => void;
