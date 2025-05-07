import { 
  HCS10Client, 
  Logger
} from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
import { TokenServiceHCS10 } from './token-service-hcs10.js';

const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');

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
export class ProposalHandlerService {
  private client: HCS10Client;
  private tokenService: TokenServiceHCS10;
  private logger: Logger;
  private pendingProposals: Map<string, Proposal> = new Map();
  private executedProposals: Map<string, Proposal> = new Map();
  private agentTopicId: string | null = null;
  
  constructor(client: HCS10Client, tokenService: TokenServiceHCS10) {
    this.client = client;
    this.tokenService = tokenService;
    this.logger = new Logger({
      module: 'ProposalHandler',
      level: 'debug',
      prettyPrint: true,
    });
  }
  
  /**
   * Initialize the service by loading existing proposals and registration info
   */
  async initialize(agentTopicId: string): Promise<boolean> {
    try {
      this.agentTopicId = agentTopicId;
      
      // Load existing proposals
      await this.loadProposals();
      
      this.logger.info(`Initialized with agent topic ${this.agentTopicId}, ${this.pendingProposals.size} pending and ${this.executedProposals.size} executed proposals`);
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize proposal handler:', error);
      return false;
    }
  }
  
  /**
   * Load existing proposals from files
   */
  private async loadProposals(): Promise<void> {
    try {
      // Load pending proposals
      const pendingData = await fs.readFile(PENDING_PROPOSALS_FILE, 'utf8').catch(() => '[]');
      const pendingProposals = JSON.parse(pendingData);
      
      // Clear and refill maps
      this.pendingProposals.clear();
      for (const proposal of pendingProposals) {
        this.pendingProposals.set(proposal.proposalId, proposal);
      }
      
      // Load executed proposals
      const executedData = await fs.readFile(EXECUTED_PROPOSALS_FILE, 'utf8').catch(() => '[]');
      const executedProposals = JSON.parse(executedData);
      
      this.executedProposals.clear();
      for (const proposal of executedProposals) {
        this.executedProposals.set(proposal.proposalId, proposal);
      }
      
      this.logger.info(`Loaded ${this.pendingProposals.size} pending and ${this.executedProposals.size} executed proposals`);
    } catch (error) {
      this.logger.error('Failed to load proposals:', error);
      // Initialize with empty proposals
      this.pendingProposals.clear();
      this.executedProposals.clear();
    }
  }
  
  /**
   * Save current proposals to files
   */
  private async saveProposals(): Promise<void> {
    try {
      // Save pending proposals
      const pendingArray = Array.from(this.pendingProposals.values());
      await fs.writeFile(PENDING_PROPOSALS_FILE, JSON.stringify(pendingArray, null, 2));
      
      // Save executed proposals
      const executedArray = Array.from(this.executedProposals.values());
      await fs.writeFile(EXECUTED_PROPOSALS_FILE, JSON.stringify(executedArray, null, 2));
      
      this.logger.info('Saved proposals to files');
    } catch (error) {
      this.logger.error('Failed to save proposals:', error);
    }
  }
  
  /**
   * Handle a rebalance proposal
   * @param message The rebalance proposal message
   * @param senderId The sender's account ID
   */
  async handleRebalanceProposal(message: any, senderId: string): Promise<void> {
    try {
      this.logger.info(`Processing rebalance proposal ${message.proposalId} from ${senderId}`);
      
      // Validate the proposal
      if (!message.proposalId || !message.newWeights) {
        this.logger.error('Invalid proposal format - missing required fields');
        return;
      }
      
      // Check if the proposal already exists
      if (this.pendingProposals.has(message.proposalId) || this.executedProposals.has(message.proposalId)) {
        this.logger.info(`Proposal ${message.proposalId} already exists`);
        return;
      }
      
      // Create a new proposal
      const proposal: Proposal = {
        proposalId: message.proposalId,
        newWeights: message.newWeights,
        receiveTime: Date.now(),
        status: 'pending'
      };
      
      // Store the proposal
      this.pendingProposals.set(proposal.proposalId, proposal);
      await this.saveProposals();
      
      this.logger.info(`Stored rebalance proposal ${proposal.proposalId}`);
    } catch (error) {
      this.logger.error('Error handling rebalance proposal:', error);
    }
  }
  
  /**
   * Handle a rebalance approval
   * @param message The rebalance approval message
   * @param senderId The sender's account ID
   */
  async handleRebalanceApproval(message: any, senderId: string): Promise<void> {
    try {
      this.logger.info(`Processing rebalance approval for proposal ${message.proposalId} from ${senderId}`);
      
      // Validate the approval
      if (!message.proposalId) {
        this.logger.error('Invalid approval format - missing proposalId');
        return;
      }
      
      // Check if the proposal exists
      const proposal = this.pendingProposals.get(message.proposalId);
      if (!proposal) {
        this.logger.error(`Proposal ${message.proposalId} not found`);
        return;
      }
      
      // Execute the rebalance
      await this.executeRebalance(proposal.proposalId);
    } catch (error) {
      this.logger.error('Error handling rebalance approval:', error);
    }
  }
  
  /**
   * Execute a rebalance proposal
   * @param proposalId The ID of the proposal to execute
   */
  async executeRebalance(proposalId: string): Promise<void> {
    try {
      const proposal = this.pendingProposals.get(proposalId);
      if (!proposal) {
        this.logger.error(`Proposal ${proposalId} not found`);
        return;
      }
      
      this.logger.info(`Executing rebalance proposal ${proposalId}`);
      
      // Get current token balances
      const preBalances = await this.tokenService.getCurrentBalances();
      
      // Execute the rebalance
      const success = await this.tokenService.rebalance(proposal.newWeights);
      
      if (success) {
        // Get updated balances
        const postBalances = await this.tokenService.getCurrentBalances();
        
        // Update proposal status
        proposal.status = 'executed';
        
        // Move from pending to executed
        this.pendingProposals.delete(proposalId);
        this.executedProposals.set(proposalId, proposal);
        
        await this.saveProposals();
        
        // Publish the execution result
        await this.publishRebalanceExecution(proposalId, preBalances, postBalances);
        
        this.logger.info(`Successfully executed rebalance proposal ${proposalId}`);
      } else {
        // Update proposal status to failed
        proposal.status = 'failed';
        proposal.error = 'Rebalance operation failed';
        
        await this.saveProposals();
        
        this.logger.error(`Failed to execute rebalance proposal ${proposalId}`);
      }
    } catch (error) {
      this.logger.error(`Error executing rebalance proposal ${proposalId}:`, error);
      
      // Update proposal status to failed
      const proposal = this.pendingProposals.get(proposalId);
      if (proposal) {
        proposal.status = 'failed';
        proposal.error = error instanceof Error ? error.message : 'Unknown error';
        
        await this.saveProposals();
      }
    }
  }
  
  /**
   * Publish the rebalance execution result
   * @param proposalId The ID of the executed proposal
   * @param preBalances The token balances before rebalance
   * @param postBalances The token balances after rebalance
   */
  private async publishRebalanceExecution(
    proposalId: string,
    preBalances: Record<string, number>,
    postBalances: Record<string, number>
  ): Promise<void> {
    try {
      if (!this.agentTopicId) {
        this.logger.error('Cannot publish execution result - agent topic ID is missing');
        return;
      }
      
      // Create the execution message
      const executionMessage = {
        type: 'RebalanceExecuted',
        proposalId: proposalId,
        preBalances: preBalances,
        postBalances: postBalances,
        executedAt: Date.now(),
        executedBy: 'LynxifyAgent'
      };
      
      // Send the message to the agent topic
      await this.client.sendMessage(
        this.agentTopicId,
        JSON.stringify(executionMessage)
      );
      
      this.logger.info(`Published execution result for proposal ${proposalId}`);
    } catch (error) {
      this.logger.error('Error publishing execution result:', error);
    }
  }
  
  /**
   * Get all pending proposals
   */
  getPendingProposals(): Proposal[] {
    return Array.from(this.pendingProposals.values());
  }
  
  /**
   * Get all executed proposals
   */
  getExecutedProposals(): Proposal[] {
    return Array.from(this.executedProposals.values());
  }
  
  /**
   * Get a specific proposal by ID
   * @param proposalId The ID of the proposal to get
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.pendingProposals.get(proposalId) || this.executedProposals.get(proposalId);
  }
}

// Export factory function
export function createProposalHandler(client: HCS10Client, tokenService: TokenServiceHCS10): ProposalHandlerService {
  return new ProposalHandlerService(client, tokenService);
} 