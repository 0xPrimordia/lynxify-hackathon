export interface HCSMessage {
  id: string;
  type: string;
  timestamp: number;
  sender?: string;
  tokenId?: string;
  price?: number;
  priceChange?: number;
  newWeights?: Record<string, number>;
  riskLevel?: string;
  affectedTokens?: string[];
  details?: {
    proposalId?: string;
    approvedAt?: number;
    executedAt?: number;
    preBalances?: Record<string, number>;
    postBalances?: Record<string, number>;
    message?: string;
    impact?: string;
    trigger?: string;
    deviation?: number;
  };
  payload?: any;
  data?: any;
}

export interface TokenWeight {
  tokenId: string;
  symbol: string;
  weight: number;
  price: number;
}

export interface Proposal {
  id: string;
  type: 'RebalanceProposal' | 'RiskAlert' | 'PolicyChange';
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  timestamp: number;
  sender: string;
  details: {
    newWeights?: Record<string, number>;
    policy?: string;
    riskLevel?: string;
    trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled';
    deviation?: number;
    impact?: string;
    executedAt?: number;
  };
  votes: {
    for: number;
    against: number;
    total: number;
  };
}

export interface Agent {
  id: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  lastMessage?: HCSMessage;
} 