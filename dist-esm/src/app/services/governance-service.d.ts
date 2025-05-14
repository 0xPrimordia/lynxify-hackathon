import { SharedHederaService } from './shared-hedera-service';
import { TokenService } from './token-service';
/**
 * Governance proposal types
 */
export declare enum ProposalType {
    REBALANCE = "rebalance",
    PARAMETER_CHANGE = "parameter_change",
    TOKEN_ADDITION = "token_addition",
    TOKEN_REMOVAL = "token_removal",
    FEE_CHANGE = "fee_change",
    PROTOCOL_UPGRADE = "protocol_upgrade"
}
/**
 * Governance proposal status
 */
export declare enum ProposalStatus {
    PENDING = "pending",
    ACTIVE = "active",
    PASSED = "passed",
    EXECUTED = "executed",
    REJECTED = "rejected",
    EXPIRED = "expired",
    CANCELED = "canceled"
}
/**
 * Vote types
 */
export declare enum VoteType {
    FOR = "for",
    AGAINST = "against",
    ABSTAIN = "abstain"
}
/**
 * Governance proposal interface
 */
export interface Proposal {
    id: string;
    title: string;
    description: string;
    type: ProposalType;
    status: ProposalStatus;
    creator: string;
    createdAt: number;
    expiresAt: number;
    executesAt?: number;
    executedAt?: number;
    votes: {
        for: number;
        against: number;
        abstain: number;
        total: number;
    };
    quorum: number;
    parameters: Record<string, any>;
    history: {
        timestamp: number;
        action: string;
        actor?: string;
        details?: Record<string, any>;
    }[];
}
/**
 * Vote record
 */
export interface Vote {
    proposalId: string;
    voter: string;
    voteType: VoteType;
    weight: number;
    timestamp: number;
}
/**
 * Governance service configuration
 */
export interface GovernanceConfig {
    governanceTopicId: string;
    votingPeriodMs: number;
    executionDelayMs: number;
    minimumQuorum: number;
    proposalThreshold: number;
}
/**
 * Service that handles governance proposals and voting
 */
export declare class GovernanceService {
    private readonly eventBus;
    private readonly hederaService;
    private readonly tokenService;
    private readonly config;
    private proposals;
    private votes;
    private proposalCheckInterval;
    private initialized;
    /**
     * Create a new GovernanceService
     */
    constructor(hederaService: SharedHederaService, tokenService: TokenService, config: GovernanceConfig);
    /**
     * Set up event handlers for this service
     */
    private setupEventHandlers;
    /**
     * Process messages from the governance topic
     */
    private processGovernanceMessage;
    /**
     * Handle a proposal submission message
     */
    private handleProposalSubmission;
    /**
     * Validate that proposal creator meets the token threshold
     */
    private validateProposalThreshold;
    /**
     * Handle a proposal vote message
     */
    private handleProposalVote;
    /**
     * Validate a voter's voting power
     */
    private validateVotingPower;
    /**
     * Check if a proposal has reached a decision based on votes
     */
    private checkProposalOutcome;
    /**
     * Handle a proposal execution message
     */
    private handleProposalExecution;
    /**
     * Execute a governance proposal
     */
    private executeProposal;
    /**
     * Execute a rebalance proposal
     */
    private executeRebalanceProposal;
    /**
     * Execute a parameter change proposal
     */
    private executeParameterChangeProposal;
    /**
     * Execute a token addition proposal
     */
    private executeTokenAdditionProposal;
    /**
     * Execute a token removal proposal
     */
    private executeTokenRemovalProposal;
    /**
     * Execute a fee change proposal
     */
    private executeFeeChangeProposal;
    /**
     * Execute a protocol upgrade proposal
     */
    private executeProtocolUpgradeProposal;
    /**
     * Handle a proposal cancellation message
     */
    private handleProposalCancellation;
    /**
     * Broadcast proposal status update
     */
    private broadcastProposalStatus;
    /**
     * Create and submit a new governance proposal
     */
    createProposal(title: string, description: string, type: ProposalType, parameters: Record<string, any>, creator: string): Promise<string>;
    /**
     * Submit a vote on a proposal
     */
    submitVote(proposalId: string, voter: string, voteType: VoteType, weight: number): Promise<void>;
    /**
     * Execute a passed proposal
     */
    executeProposalById(proposalId: string, executor: string): Promise<void>;
    /**
     * Cancel a proposal
     */
    cancelProposal(proposalId: string, canceler: string, reason?: string): Promise<void>;
    /**
     * Initialize the service
     */
    initialize(): Promise<void>;
    /**
     * Check for expired proposals
     */
    private checkProposalExpirations;
    /**
     * Get a specific proposal by ID
     */
    getProposal(proposalId: string): Proposal | undefined;
    /**
     * Get all proposals
     */
    getAllProposals(): Proposal[];
    /**
     * Get proposals by status
     */
    getProposalsByStatus(status: ProposalStatus): Proposal[];
    /**
     * Get votes for a specific proposal
     */
    getVotesForProposal(proposalId: string): Vote[];
    /**
     * Check if the service is initialized
     */
    isInitialized(): boolean;
    /**
     * Clean up resources
     */
    cleanup(): void;
    /**
     * Add new event types to EventType enum
     */
    private ensureEventTypesExist;
}
