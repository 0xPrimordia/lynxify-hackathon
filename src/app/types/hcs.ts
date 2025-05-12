export interface HCSMessage {
  id: string;
  type: 'PriceUpdate' | 'RiskAlert' | 'RebalanceProposal' | 'RebalanceApproved' | 'RebalanceExecuted' | 'PolicyChange' | 'AgentInfo' | 'AgentResponse' | 'AgentRequest';
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
    riskDescription?: string;
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
    // Moonscape fields
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

// Define specific message type interfaces
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

// Type guard functions
export function isRebalanceProposal(message: HCSMessage | null | undefined): message is RebalanceProposal {
  return !!message && message.type === 'RebalanceProposal';
}

export function isRebalanceApproved(message: HCSMessage | null | undefined): message is RebalanceApproved {
  return !!message && message.type === 'RebalanceApproved';
}

export function isRebalanceExecuted(message: HCSMessage | null | undefined): message is RebalanceExecuted {
  return !!message && message.type === 'RebalanceExecuted';
}

export function isPriceUpdate(message: HCSMessage | null | undefined): message is PriceUpdate {
  return !!message && message.type === 'PriceUpdate';
}

export function isRiskAlert(message: HCSMessage | null | undefined): message is RiskAlert {
  return !!message && message.type === 'RiskAlert';
}

export function isPolicyChange(message: HCSMessage | null | undefined): message is PolicyChange {
  return !!message && message.type === 'PolicyChange';
}

export function isMoonscapeMessage(message: HCSMessage | null | undefined): message is HCSMessage & { type: 'AgentInfo' | 'AgentResponse' | 'AgentRequest' } {
  return !!message && (message.type === 'AgentInfo' || message.type === 'AgentResponse' || message.type === 'AgentRequest');
}

// SDK Types
export type SDKCallback = (message: { message: string; sequence_number: number; }) => void; 