export interface HCSMessage {
  id: string;
  type: 'PriceUpdate' | 'RiskAlert' | 'RebalanceProposal' | 'RebalanceApproved' | 'RebalanceExecuted' | 'PolicyChange' | 'AgentResponse' | 'AgentRequest' | 'AgentInfo';
  timestamp: number;
  sender: string;
  details: {
    // Common fields
    message?: string;
    impact?: string;
    // PriceUpdate fields
    tokenId?: string;
    price?: number;
    source?: string;
    // RiskAlert fields
    severity?: 'low' | 'medium' | 'high';
    description?: string;
    affectedTokens?: string[];
    metrics?: {
      volatility?: number;
      volume?: number;
      priceChange?: number;
    };
    // RebalanceProposal fields
    trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled';
    deviation?: number;
    riskLevel?: string;
    newWeights?: Record<string, number>;
    executeAfter?: number;
    quorum?: number;
    // RebalanceApproved fields
    proposalId?: string;
    approvedAt?: number;
    // RebalanceExecuted fields
    preBalances?: Record<string, number>;
    postBalances?: Record<string, number>;
    executedAt?: number;
    // PolicyChange fields
    policyId?: string;
    changes?: {
      maxWeight?: number;
      minLiquidity?: number;
      stopLossThreshold?: number;
      rebalanceThreshold?: number;
    };
    effectiveFrom?: number;
    // Test fields for HCS-10 demo
    testId?: string;
    // Moonscape fields
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

export function isValidHCSMessage(message: any): message is HCSMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof message.id === 'string' &&
    typeof message.type === 'string' &&
    typeof message.timestamp === 'number' &&
    typeof message.sender === 'string' &&
    typeof message.details === 'object'
  );
}

export function isRebalanceProposal(message: HCSMessage): message is HCSMessage & { type: 'RebalanceProposal' } {
  return message.type === 'RebalanceProposal';
}

export function isRiskAlert(message: HCSMessage): message is HCSMessage & { type: 'RiskAlert' } {
  return message.type === 'RiskAlert';
}

export function isPolicyChange(message: HCSMessage): message is HCSMessage & { type: 'PolicyChange' } {
  return message.type === 'PolicyChange';
}

// Define a callback type for the HCS-10 SDK
export type SDKCallback = (message: any) => void; 