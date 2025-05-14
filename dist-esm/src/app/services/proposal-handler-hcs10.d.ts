import { HCS10Client } from '@hashgraphonline/standards-sdk';
import { TokenServiceHCS10 } from './token-service-hcs10.js';
interface Proposal {
    proposalId: string;
    newWeights: Record<string, number>;
    receiveTime: number;
    status: 'pending' | 'executed' | 'failed';
    error?: string;
}
/**
 * Proposal Handler Service for HCS-10
 * Handles rebalance proposals according to Lynxify Index specifications
 */
export declare class ProposalHandlerService {
    private client;
    private tokenService;
    private logger;
    private pendingProposals;
    private executedProposals;
    private agentTopicId;
    constructor(client: HCS10Client, tokenService: TokenServiceHCS10);
    /**
     * Initialize the service by loading existing proposals and registration info
     */
    initialize(agentTopicId: string): Promise<boolean>;
    /**
     * Load existing proposals from files
     */
    private loadProposals;
    /**
     * Save current proposals to files
     */
    private saveProposals;
    /**
     * Handle a rebalance proposal
     * @param message The rebalance proposal message
     * @param senderId The sender's account ID
     */
    handleRebalanceProposal(message: any, senderId: string): Promise<void>;
    /**
     * Handle a rebalance approval
     * @param message The rebalance approval message
     * @param senderId The sender's account ID
     */
    handleRebalanceApproval(message: any, senderId: string): Promise<void>;
    /**
     * Execute a rebalance proposal
     * @param proposalId The ID of the proposal to execute
     */
    executeRebalance(proposalId: string): Promise<void>;
    /**
     * Publish the rebalance execution result
     * @param proposalId The ID of the executed proposal
     * @param preBalances The token balances before rebalance
     * @param postBalances The token balances after rebalance
     */
    private publishRebalanceExecution;
    /**
     * Get all pending proposals
     */
    getPendingProposals(): Proposal[];
    /**
     * Get all executed proposals
     */
    getExecutedProposals(): Proposal[];
    /**
     * Get a specific proposal by ID
     * @param proposalId The ID of the proposal to get
     */
    getProposal(proposalId: string): Proposal | undefined;
}
export declare function createProposalHandler(client: HCS10Client, tokenService: TokenServiceHCS10): ProposalHandlerService;
export {};
