import { EventBus, EventType } from '../utils/event-emitter';
import { SharedHederaService } from './shared-hedera-service';
import { v4 as uuidv4 } from 'uuid';
import { TokenService } from './token-service';

/**
 * Governance proposal types
 */
export enum ProposalType {
  REBALANCE = 'rebalance',
  PARAMETER_CHANGE = 'parameter_change',
  TOKEN_ADDITION = 'token_addition',
  TOKEN_REMOVAL = 'token_removal',
  FEE_CHANGE = 'fee_change',
  PROTOCOL_UPGRADE = 'protocol_upgrade'
}

/**
 * Governance proposal status
 */
export enum ProposalStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PASSED = 'passed',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELED = 'canceled'
}

/**
 * Vote types
 */
export enum VoteType {
  FOR = 'for',
  AGAINST = 'against',
  ABSTAIN = 'abstain'
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
export class GovernanceService {
  private readonly eventBus: EventBus;
  private readonly hederaService: SharedHederaService;
  private readonly tokenService: TokenService;
  private readonly config: GovernanceConfig;
  
  private proposals: Map<string, Proposal> = new Map();
  private votes: Map<string, Vote[]> = new Map();
  
  private proposalCheckInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  
  /**
   * Create a new GovernanceService
   */
  constructor(
    hederaService: SharedHederaService,
    tokenService: TokenService,
    config: GovernanceConfig
  ) {
    this.hederaService = hederaService;
    this.tokenService = tokenService;
    this.config = {
      ...config,
      votingPeriodMs: config.votingPeriodMs || 7 * 24 * 60 * 60 * 1000, // Default 7 days
      executionDelayMs: config.executionDelayMs || 2 * 24 * 60 * 60 * 1000, // Default 2 days
      minimumQuorum: config.minimumQuorum || 0.1, // Default 10%
      proposalThreshold: config.proposalThreshold || 0.05 // Default 5%
    };
    this.eventBus = EventBus.getInstance();
    
    this.setupEventHandlers();
  }
  
  /**
   * Set up event handlers for this service
   */
  private setupEventHandlers(): void {
    // Listen for messages received from the governance topic
    this.eventBus.onEvent(EventType.MESSAGE_RECEIVED, (data) => {
      if (data.topicId === this.config.governanceTopicId) {
        this.processGovernanceMessage(data);
      }
    });
    
    // Listen for system shutdown
    this.eventBus.onEvent(EventType.SYSTEM_SHUTDOWN, () => {
      this.cleanup();
    });
  }
  
  /**
   * Process messages from the governance topic
   */
  private processGovernanceMessage(data: any): void {
    try {
      const message = data.contents;
      
      // Handle different message types
      switch (message.type) {
        case 'ProposalSubmission':
          this.handleProposalSubmission(message);
          break;
        case 'ProposalVote':
          this.handleProposalVote(message);
          break;
        case 'ProposalExecution':
          this.handleProposalExecution(message);
          break;
        case 'ProposalCancellation':
          this.handleProposalCancellation(message);
          break;
        default:
          console.log(`ℹ️ Ignoring unknown governance message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error processing governance message:', error);
    }
  }
  
  /**
   * Handle a proposal submission message
   */
  private handleProposalSubmission(message: any): void {
    const { 
      proposalId, 
      title, 
      description, 
      type, 
      creator, 
      parameters 
    } = message.details;
    
    if (!proposalId || !type || !creator) {
      console.warn('⚠️ Invalid proposal submission message:', message);
      return;
    }
    
    // Validate proposal type
    if (!Object.values(ProposalType).includes(type)) {
      console.warn(`⚠️ Invalid proposal type: ${type}`);
      return;
    }
    
    // Check if proposal already exists
    if (this.proposals.has(proposalId)) {
      console.warn(`⚠️ Proposal with ID ${proposalId} already exists`);
      return;
    }
    
    const now = Date.now();
    
    // Create new proposal
    const proposal: Proposal = {
      id: proposalId,
      title: title || `Proposal ${proposalId}`,
      description: description || '',
      type: type as ProposalType,
      status: ProposalStatus.PENDING,
      creator,
      createdAt: now,
      expiresAt: now + this.config.votingPeriodMs,
      votes: {
        for: 0,
        against: 0,
        abstain: 0,
        total: 0
      },
      quorum: this.config.minimumQuorum,
      parameters: parameters || {},
      history: [
        {
          timestamp: now,
          action: 'created',
          actor: creator
        }
      ]
    };
    
    // Store the proposal
    this.proposals.set(proposalId, proposal);
    
    // Initialize votes collection for this proposal
    this.votes.set(proposalId, []);
    
    console.log(`📝 New governance proposal received: ${proposalId}`);
    
    // Validate proposal creator has enough tokens to submit proposal
    this.validateProposalThreshold(proposal).then(isValid => {
      if (isValid) {
        // Activate the proposal
        proposal.status = ProposalStatus.ACTIVE;
        proposal.history.push({
          timestamp: Date.now(),
          action: 'activated'
        });
        
        // Notify about new active proposal
        this.eventBus.emitEvent(EventType.INDEX_PROPOSAL_CREATED, {
          proposalId,
          type: proposal.type,
          creator: proposal.creator
        });
        
        console.log(`✅ Proposal ${proposalId} activated for voting`);
        
        // Broadcast proposal activation
        this.broadcastProposalStatus(proposal);
      } else {
        // Reject the proposal due to insufficient tokens
        proposal.status = ProposalStatus.REJECTED;
        proposal.history.push({
          timestamp: Date.now(),
          action: 'rejected',
          details: { reason: 'insufficient_tokens' }
        });
        
        console.log(`❌ Proposal ${proposalId} rejected: creator does not meet threshold`);
        
        // Broadcast rejection
        this.broadcastProposalStatus(proposal);
      }
    }).catch(error => {
      console.error(`❌ Error validating proposal threshold: ${error}`);
    });
  }
  
  /**
   * Validate that proposal creator meets the token threshold
   */
  private async validateProposalThreshold(proposal: Proposal): Promise<boolean> {
    try {
      // In a real implementation, this would check the creator's token balance
      // against the required threshold
      
      // For demo purposes, always return true
      return true;
    } catch (error) {
      console.error('❌ Error validating proposal threshold:', error);
      return false;
    }
  }
  
  /**
   * Handle a proposal vote message
   */
  private handleProposalVote(message: any): void {
    const { proposalId, voter, voteType, weight } = message.details;
    
    if (!proposalId || !voter || !voteType) {
      console.warn('⚠️ Invalid proposal vote message:', message);
      return;
    }
    
    // Validate vote type
    if (!Object.values(VoteType).includes(voteType)) {
      console.warn(`⚠️ Invalid vote type: ${voteType}`);
      return;
    }
    
    // Check if proposal exists and is active
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      console.warn(`⚠️ Vote for non-existent proposal: ${proposalId}`);
      return;
    }
    
    if (proposal.status !== ProposalStatus.ACTIVE) {
      console.warn(`⚠️ Vote for non-active proposal: ${proposalId} (status: ${proposal.status})`);
      return;
    }
    
    // Check if voting period has expired
    if (Date.now() > proposal.expiresAt) {
      console.warn(`⚠️ Vote for expired proposal: ${proposalId}`);
      return;
    }
    
    // Validate voter's voting power
    this.validateVotingPower(voter, weight).then(validWeight => {
      // Get vote collection for this proposal
      const proposalVotes = this.votes.get(proposalId) || [];
      
      // Check if voter has already voted
      const existingVoteIndex = proposalVotes.findIndex(v => v.voter === voter);
      
      if (existingVoteIndex >= 0) {
        // Update existing vote
        const existingVote = proposalVotes[existingVoteIndex];
        
        // Remove old vote amount from totals
        proposal.votes[existingVote.voteType as keyof typeof proposal.votes] -= existingVote.weight;
        proposal.votes.total -= existingVote.weight;
        
        // Update vote
        existingVote.voteType = voteType as VoteType;
        existingVote.weight = validWeight;
        existingVote.timestamp = Date.now();
        
        proposalVotes[existingVoteIndex] = existingVote;
      } else {
        // Add new vote
        const newVote: Vote = {
          proposalId,
          voter,
          voteType: voteType as VoteType,
          weight: validWeight,
          timestamp: Date.now()
        };
        
        proposalVotes.push(newVote);
      }
      
      // Update vote counts in proposal
      proposal.votes[voteType as keyof typeof proposal.votes] += validWeight;
      proposal.votes.total += validWeight;
      
      // Update votes collection
      this.votes.set(proposalId, proposalVotes);
      
      // Add to proposal history
      proposal.history.push({
        timestamp: Date.now(),
        action: 'vote_cast',
        actor: voter,
        details: { voteType, weight: validWeight }
      });
      
      console.log(`🗳️ Vote recorded for proposal ${proposalId}: ${voter} voted ${voteType} with weight ${validWeight}`);
      
      // Check if proposal can be decided based on current votes
      this.checkProposalOutcome(proposal);
    }).catch(error => {
      console.error(`❌ Error validating voting power: ${error}`);
    });
  }
  
  /**
   * Validate a voter's voting power
   */
  private async validateVotingPower(voter: string, claimedWeight: number): Promise<number> {
    try {
      // In a real implementation, this would check the voter's token balance
      // and return their actual voting power
      
      // For demo purposes, return claimed weight (capped at 100)
      return Math.min(claimedWeight, 100);
    } catch (error) {
      console.error('❌ Error validating voting power:', error);
      return 0;
    }
  }
  
  /**
   * Check if a proposal has reached a decision based on votes
   */
  private checkProposalOutcome(proposal: Proposal): void {
    // Skip if proposal is not active
    if (proposal.status !== ProposalStatus.ACTIVE) {
      return;
    }
    
    // Check if quorum has been reached
    const totalVotingPower = 1000; // In a real implementation, this would be the total supply
    const quorumPercentage = proposal.votes.total / totalVotingPower;
    
    if (quorumPercentage < proposal.quorum) {
      // Quorum not yet reached
      return;
    }
    
    // Check if proposal has passed
    if (proposal.votes.for > proposal.votes.against) {
      // Proposal passed
      proposal.status = ProposalStatus.PASSED;
      proposal.executesAt = Date.now() + this.config.executionDelayMs;
      
      proposal.history.push({
        timestamp: Date.now(),
        action: 'passed',
        details: { 
          forVotes: proposal.votes.for,
          againstVotes: proposal.votes.against,
          quorumReached: quorumPercentage 
        }
      });
      
      console.log(`✅ Proposal ${proposal.id} has passed with ${proposal.votes.for} FOR votes vs ${proposal.votes.against} AGAINST votes`);
    } else {
      // Proposal rejected
      proposal.status = ProposalStatus.REJECTED;
      
      proposal.history.push({
        timestamp: Date.now(),
        action: 'rejected',
        details: { 
          forVotes: proposal.votes.for,
          againstVotes: proposal.votes.against
        }
      });
      
      console.log(`❌ Proposal ${proposal.id} has been rejected with ${proposal.votes.against} AGAINST votes vs ${proposal.votes.for} FOR votes`);
    }
    
    // Broadcast updated status
    this.broadcastProposalStatus(proposal);
  }
  
  /**
   * Handle a proposal execution message
   */
  private handleProposalExecution(message: any): void {
    const { proposalId, executor } = message.details;
    
    if (!proposalId) {
      console.warn('⚠️ Invalid proposal execution message:', message);
      return;
    }
    
    // Check if proposal exists and is passed
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      console.warn(`⚠️ Execution for non-existent proposal: ${proposalId}`);
      return;
    }
    
    if (proposal.status !== ProposalStatus.PASSED) {
      console.warn(`⚠️ Execution for non-passed proposal: ${proposalId} (status: ${proposal.status})`);
      return;
    }
    
    // Check if execution delay has passed
    if (proposal.executesAt && Date.now() < proposal.executesAt) {
      console.warn(`⚠️ Execution attempt before delay period: ${proposalId}`);
      return;
    }
    
    // Execute the proposal
    this.executeProposal(proposal).then(success => {
      if (success) {
        // Mark as executed
        proposal.status = ProposalStatus.EXECUTED;
        proposal.executedAt = Date.now();
        
        proposal.history.push({
          timestamp: Date.now(),
          action: 'executed',
          actor: executor || 'system'
        });
        
        console.log(`✅ Proposal ${proposalId} executed successfully`);
      } else {
        // Mark execution as failed
        proposal.history.push({
          timestamp: Date.now(),
          action: 'execution_failed',
          actor: executor || 'system'
        });
        
        console.log(`❌ Proposal ${proposalId} execution failed`);
      }
      
      // Broadcast updated status
      this.broadcastProposalStatus(proposal);
    }).catch(error => {
      console.error(`❌ Error executing proposal: ${error}`);
      
      // Add error to history
      proposal.history.push({
        timestamp: Date.now(),
        action: 'execution_error',
        details: { error: error.message || String(error) }
      });
      
      // Broadcast updated status
      this.broadcastProposalStatus(proposal);
    });
  }
  
  /**
   * Execute a governance proposal
   */
  private async executeProposal(proposal: Proposal): Promise<boolean> {
    console.log(`🔄 Executing proposal ${proposal.id} of type ${proposal.type}`);
    
    try {
      switch (proposal.type) {
        case ProposalType.REBALANCE:
          return await this.executeRebalanceProposal(proposal);
          
        case ProposalType.PARAMETER_CHANGE:
          return await this.executeParameterChangeProposal(proposal);
          
        case ProposalType.TOKEN_ADDITION:
          return await this.executeTokenAdditionProposal(proposal);
          
        case ProposalType.TOKEN_REMOVAL:
          return await this.executeTokenRemovalProposal(proposal);
          
        case ProposalType.FEE_CHANGE:
          return await this.executeFeeChangeProposal(proposal);
          
        case ProposalType.PROTOCOL_UPGRADE:
          return await this.executeProtocolUpgradeProposal(proposal);
          
        default:
          console.warn(`⚠️ Unknown proposal type: ${proposal.type}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error executing proposal ${proposal.id}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a rebalance proposal
   */
  private async executeRebalanceProposal(proposal: Proposal): Promise<boolean> {
    const { newWeights } = proposal.parameters;
    
    if (!newWeights || typeof newWeights !== 'object') {
      console.warn('⚠️ Rebalance proposal missing newWeights parameter');
      return false;
    }
    
    // Emit rebalance proposal event
    this.eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
      proposalId: proposal.id,
      newWeights,
      trigger: 'governance' as any // Force type for now, ideally update the trigger type in TokenizedIndexService
    });
    
    // In a real implementation, this would perform the rebalance or queue it
    // For now, we just emit the event and return success
    return true;
  }
  
  /**
   * Execute a parameter change proposal
   */
  private async executeParameterChangeProposal(proposal: Proposal): Promise<boolean> {
    const { paramName, paramValue } = proposal.parameters;
    
    if (!paramName || paramValue === undefined) {
      console.warn('⚠️ Parameter change proposal missing required parameters');
      return false;
    }
    
    // Emit parameter change event
    this.eventBus.emitEvent(EventType.INDEX_POLICY_CHANGED, {
      policyId: proposal.id,
      changes: { [paramName]: paramValue },
      effectiveFrom: Date.now()
    });
    
    return true;
  }
  
  /**
   * Execute a token addition proposal
   */
  private async executeTokenAdditionProposal(proposal: Proposal): Promise<boolean> {
    const { tokenSymbol, tokenId, initialWeight } = proposal.parameters;
    
    if (!tokenSymbol || !tokenId) {
      console.warn('⚠️ Token addition proposal missing required parameters');
      return false;
    }
    
    // Emit token addition event
    this.eventBus.emitEvent(EventType.INDEX_TOKEN_ADDED, {
      tokenId,
      tokenSymbol,
      initialWeight: initialWeight || 0.05, // Default 5%
      addedAt: Date.now()
    });
    
    return true;
  }
  
  /**
   * Execute a token removal proposal
   */
  private async executeTokenRemovalProposal(proposal: Proposal): Promise<boolean> {
    const { tokenId } = proposal.parameters;
    
    if (!tokenId) {
      console.warn('⚠️ Token removal proposal missing required parameters');
      return false;
    }
    
    // Emit token removal event
    this.eventBus.emitEvent(EventType.INDEX_TOKEN_REMOVED, {
      tokenId,
      removedAt: Date.now()
    });
    
    return true;
  }
  
  /**
   * Execute a fee change proposal
   */
  private async executeFeeChangeProposal(proposal: Proposal): Promise<boolean> {
    const { newFeePercentage } = proposal.parameters;
    
    if (newFeePercentage === undefined || typeof newFeePercentage !== 'number') {
      console.warn('⚠️ Fee change proposal missing required parameters');
      return false;
    }
    
    // Emit fee change event
    this.eventBus.emitEvent(EventType.INDEX_POLICY_CHANGED, {
      policyId: proposal.id,
      changes: { feePercentage: newFeePercentage },
      effectiveFrom: Date.now()
    });
    
    return true;
  }
  
  /**
   * Execute a protocol upgrade proposal
   */
  private async executeProtocolUpgradeProposal(proposal: Proposal): Promise<boolean> {
    const { upgradeDetails } = proposal.parameters;
    
    if (!upgradeDetails) {
      console.warn('⚠️ Protocol upgrade proposal missing required parameters');
      return false;
    }
    
    // Emit protocol upgrade event
    this.eventBus.emitEvent(EventType.INDEX_POLICY_CHANGED, {
      policyId: proposal.id,
      changes: { protocolUpgrade: upgradeDetails },
      effectiveFrom: Date.now()
    });
    
    return true;
  }
  
  /**
   * Handle a proposal cancellation message
   */
  private handleProposalCancellation(message: any): void {
    const { proposalId, canceler, reason } = message.details;
    
    if (!proposalId) {
      console.warn('⚠️ Invalid proposal cancellation message:', message);
      return;
    }
    
    // Check if proposal exists
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      console.warn(`⚠️ Cancellation for non-existent proposal: ${proposalId}`);
      return;
    }
    
    // Validate canceler is the creator or authorized
    if (canceler !== proposal.creator) {
      console.warn(`⚠️ Unauthorized cancellation attempt for proposal: ${proposalId}`);
      return;
    }
    
    // Check if proposal can be canceled
    if (proposal.status !== ProposalStatus.ACTIVE && proposal.status !== ProposalStatus.PENDING) {
      console.warn(`⚠️ Cannot cancel proposal with status: ${proposal.status}`);
      return;
    }
    
    // Mark as canceled
    proposal.status = ProposalStatus.CANCELED;
    
    proposal.history.push({
      timestamp: Date.now(),
      action: 'canceled',
      actor: canceler,
      details: { reason: reason || 'no reason provided' }
    });
    
    console.log(`🚫 Proposal ${proposalId} canceled by ${canceler}: ${reason || 'no reason provided'}`);
    
    // Broadcast updated status
    this.broadcastProposalStatus(proposal);
  }
  
  /**
   * Broadcast proposal status update
   */
  private async broadcastProposalStatus(proposal: Proposal): Promise<void> {
    const statusMessage = {
      id: uuidv4(),
      type: 'ProposalStatusUpdate',
      timestamp: Date.now(),
      sender: 'governance-service',
      details: {
        proposalId: proposal.id,
        status: proposal.status,
        votes: proposal.votes,
        updatedAt: Date.now()
      }
    };
    
    try {
      // Send to governance topic
      await this.hederaService.sendMessage(this.config.governanceTopicId, statusMessage);
      
      console.log(`📤 Broadcast status update for proposal ${proposal.id}: ${proposal.status}`);
    } catch (error) {
      console.error(`❌ Failed to broadcast proposal status update:`, error);
    }
  }
  
  /**
   * Create and submit a new governance proposal
   */
  public async createProposal(
    title: string,
    description: string,
    type: ProposalType,
    parameters: Record<string, any>,
    creator: string
  ): Promise<string> {
    const proposalId = uuidv4();
    
    const proposalMessage = {
      id: uuidv4(),
      type: 'ProposalSubmission',
      timestamp: Date.now(),
      sender: 'governance-service',
      details: {
        proposalId,
        title,
        description,
        type,
        creator,
        parameters
      }
    };
    
    try {
      // Send to governance topic
      await this.hederaService.sendMessage(this.config.governanceTopicId, proposalMessage);
      
      console.log(`📤 Submitted new proposal: ${proposalId}`);
      return proposalId;
    } catch (error) {
      console.error('❌ Failed to submit proposal:', error);
      throw error;
    }
  }
  
  /**
   * Submit a vote on a proposal
   */
  public async submitVote(
    proposalId: string,
    voter: string,
    voteType: VoteType,
    weight: number
  ): Promise<void> {
    const voteMessage = {
      id: uuidv4(),
      type: 'ProposalVote',
      timestamp: Date.now(),
      sender: 'governance-service',
      details: {
        proposalId,
        voter,
        voteType,
        weight
      }
    };
    
    try {
      // Send to governance topic
      await this.hederaService.sendMessage(this.config.governanceTopicId, voteMessage);
      
      console.log(`📤 Submitted vote on proposal ${proposalId}`);
    } catch (error) {
      console.error('❌ Failed to submit vote:', error);
      throw error;
    }
  }
  
  /**
   * Execute a passed proposal
   */
  public async executeProposalById(proposalId: string, executor: string): Promise<void> {
    const executionMessage = {
      id: uuidv4(),
      type: 'ProposalExecution',
      timestamp: Date.now(),
      sender: 'governance-service',
      details: {
        proposalId,
        executor
      }
    };
    
    try {
      // Send to governance topic
      await this.hederaService.sendMessage(this.config.governanceTopicId, executionMessage);
      
      console.log(`📤 Submitted execution request for proposal ${proposalId}`);
    } catch (error) {
      console.error('❌ Failed to submit execution request:', error);
      throw error;
    }
  }
  
  /**
   * Cancel a proposal
   */
  public async cancelProposal(
    proposalId: string,
    canceler: string,
    reason?: string
  ): Promise<void> {
    const cancellationMessage = {
      id: uuidv4(),
      type: 'ProposalCancellation',
      timestamp: Date.now(),
      sender: 'governance-service',
      details: {
        proposalId,
        canceler,
        reason
      }
    };
    
    try {
      // Send to governance topic
      await this.hederaService.sendMessage(this.config.governanceTopicId, cancellationMessage);
      
      console.log(`📤 Submitted cancellation request for proposal ${proposalId}`);
    } catch (error) {
      console.error('❌ Failed to submit cancellation request:', error);
      throw error;
    }
  }
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      console.log('🔄 Initializing GovernanceService...');
      
      // Set up proposal expiration check interval
      this.proposalCheckInterval = setInterval(
        () => this.checkProposalExpirations(),
        5 * 60 * 1000 // Every 5 minutes
      );
      
      this.initialized = true;
      console.log('✅ GovernanceService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize GovernanceService:', error);
      throw error;
    }
  }
  
  /**
   * Check for expired proposals
   */
  private checkProposalExpirations(): void {
    const now = Date.now();
    
    // Convert Map to array before iterating to avoid TypeScript error
    Array.from(this.proposals.entries()).forEach(([proposalId, proposal]) => {
      // Only check active proposals
      if (proposal.status !== ProposalStatus.ACTIVE) {
        return;
      }
      
      // Check if voting period has expired
      if (now > proposal.expiresAt) {
        console.log(`⏱️ Proposal expired: ${proposalId}`);
        
        // Check if quorum was reached
        const totalVotingPower = 1000; // In a real implementation, this would be the total supply
        const quorumPercentage = proposal.votes.total / totalVotingPower;
        
        if (quorumPercentage >= proposal.quorum) {
          // Quorum reached, determine outcome based on votes
          if (proposal.votes.for > proposal.votes.against) {
            // Proposal passed
            proposal.status = ProposalStatus.PASSED;
            proposal.executesAt = now + this.config.executionDelayMs;
            
            proposal.history.push({
              timestamp: now,
              action: 'passed',
              details: { 
                forVotes: proposal.votes.for,
                againstVotes: proposal.votes.against,
                quorumReached: quorumPercentage 
              }
            });
            
            console.log(`✅ Expired proposal ${proposalId} has passed with ${proposal.votes.for} FOR votes vs ${proposal.votes.against} AGAINST votes`);
          } else {
            // Proposal rejected
            proposal.status = ProposalStatus.REJECTED;
            
            proposal.history.push({
              timestamp: now,
              action: 'rejected',
              details: { 
                forVotes: proposal.votes.for,
                againstVotes: proposal.votes.against
              }
            });
            
            console.log(`❌ Expired proposal ${proposalId} has been rejected with ${proposal.votes.against} AGAINST votes vs ${proposal.votes.for} FOR votes`);
          }
        } else {
          // Quorum not reached, mark as expired
          proposal.status = ProposalStatus.EXPIRED;
          
          proposal.history.push({
            timestamp: now,
            action: 'expired',
            details: { 
              quorumRequired: proposal.quorum,
              quorumReached: quorumPercentage
            }
          });
          
          console.log(`⌛ Proposal ${proposalId} expired without reaching quorum`);
        }
        
        // Broadcast updated status
        this.broadcastProposalStatus(proposal);
      }
    });
  }
  
  /**
   * Get a specific proposal by ID
   */
  public getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }
  
  /**
   * Get all proposals
   */
  public getAllProposals(): Proposal[] {
    return Array.from(this.proposals.values());
  }
  
  /**
   * Get proposals by status
   */
  public getProposalsByStatus(status: ProposalStatus): Proposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === status);
  }
  
  /**
   * Get votes for a specific proposal
   */
  public getVotesForProposal(proposalId: string): Vote[] {
    return this.votes.get(proposalId) || [];
  }
  
  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.proposalCheckInterval) {
      clearInterval(this.proposalCheckInterval);
      this.proposalCheckInterval = null;
    }
  }
  
  /**
   * Add new event types to EventType enum
   */
  private ensureEventTypesExist(): void {
    // These should be defined in the EventType enum
    // INDEX_PROPOSAL_CREATED
    // INDEX_TOKEN_ADDED
    // INDEX_TOKEN_REMOVED
  }
} 