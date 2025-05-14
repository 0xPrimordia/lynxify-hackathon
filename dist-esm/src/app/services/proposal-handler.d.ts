import { HCSMessage } from '../types/hcs';
import { TokenService } from './token-service';
/**
 * Proposal Handler Service
 * Manages rebalance proposals, approvals, and executions
 */
export declare class ProposalHandlerService {
    private tokenService;
    private pendingProposals;
    private executedProposals;
    private governanceTopic;
    private agentTopic;
    private moonscapeInboundTopic;
    private moonscapeOutboundTopic;
    private operatorId;
    /**
     * Initialize the Proposal Handler Service
     * @param tokenService Service for token operations
     */
    constructor(tokenService: TokenService);
    /**
     * Handle an incoming HCS message
     * @param message The HCS message to handle
     */
    handleMessage(message: HCSMessage): Promise<void>;
    /**
     * Handle a rebalance proposal
     * @param message The proposal message
     */
    private handleProposal;
    /**
     * Approve a rebalance proposal
     * @param proposalId The ID of the proposal to approve
     */
    approveProposal(proposalId: string): Promise<void>;
    /**
     * Handle a rebalance approval
     * @param message The approval message
     */
    private handleApproval;
    /**
     * Handle an agent request message
     * @param message The request message
     */
    private handleAgentRequest;
    /**
     * Execute a rebalance operation
     * @param proposal The proposal to execute
     */
    private executeRebalance;
    /**
     * Create a test rebalance proposal for demonstration
     */
    createTestProposal(): Promise<void>;
    /**
     * Get count of pending proposals
     */
    getPendingProposalCount(): number;
    /**
     * Get count of executed proposals
     */
    getExecutedProposalCount(): number;
}
declare const _default: ProposalHandlerService;
export default _default;
