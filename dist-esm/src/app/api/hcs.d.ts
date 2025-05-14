import type { RebalanceProposal, RebalanceApproved } from '@/app/types/hcs';
export declare function publishRebalanceProposal(proposal: Omit<RebalanceProposal, 'timestamp' | 'sender'>): Promise<void>;
export declare function publishRebalanceApproval(approval: Omit<RebalanceApproved, 'timestamp' | 'sender' | 'approvedBy'>): Promise<void>;
export declare function getRecentMessages(): Promise<any>;
