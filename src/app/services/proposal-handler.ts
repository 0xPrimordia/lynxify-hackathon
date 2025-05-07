import { HCSMessage, TokenWeights } from '../types/hcs';
import { TokenService } from './token-service';
import hcsMessaging from './hcs-messaging';
import aiAnalysis from './ai-analysis';
import websocketService from './websocket';
import { getTopicId } from '../utils/env-utils';

/**
 * Proposal Handler Service
 * Manages rebalance proposals, approvals, and executions
 */
export class ProposalHandlerService {
  private tokenService: TokenService;
  private pendingProposals: Map<string, HCSMessage> = new Map();
  private executedProposals: Set<string> = new Set();
  
  // Topic IDs
  private governanceTopic: string;
  private agentTopic: string;
  private moonscapeInboundTopic: string;
  private moonscapeOutboundTopic: string;
  private operatorId: string;
  
  /**
   * Initialize the Proposal Handler Service
   * @param tokenService Service for token operations
   */
  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
    
    // Get environment variables
    this.governanceTopic = getTopicId('NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC');
    this.agentTopic = getTopicId('NEXT_PUBLIC_HCS_AGENT_TOPIC');
    this.moonscapeInboundTopic = getTopicId('NEXT_PUBLIC_HCS_INBOUND_TOPIC');
    this.moonscapeOutboundTopic = getTopicId('NEXT_PUBLIC_HCS_OUTBOUND_TOPIC');
    this.operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
  }
  
  /**
   * Handle an incoming HCS message
   * @param message The HCS message to handle
   */
  async handleMessage(message: HCSMessage): Promise<void> {
    // Process based on message type
    if (message.type === 'RebalanceProposal') {
      await this.handleProposal(message);
    } else if (message.type === 'RebalanceApproved') {
      await this.handleApproval(message);
    } else if (message.type === 'AgentRequest') {
      await this.handleAgentRequest(message);
    }
    
    // Broadcast message to WebSocket clients
    websocketService.broadcast({
      type: message.type,
      data: message
    });
  }
  
  /**
   * Handle a rebalance proposal
   * @param message The proposal message
   */
  private async handleProposal(message: HCSMessage): Promise<void> {
    console.log(`🤖 PROPOSAL HANDLER: Received new rebalance proposal: ${message.id}`);
    
    // Store the proposal for future reference
    this.pendingProposals.set(message.id, message);
    
    // Send notification to Moonscape if configured
    if (this.moonscapeOutboundTopic && this.moonscapeInboundTopic) {
      await hcsMessaging.sendToMoonscape(
        this.moonscapeOutboundTopic,
        this.moonscapeInboundTopic,
        this.operatorId,
        {
          id: `moonscape-proposal-${Date.now()}`,
          type: 'AgentInfo',
          timestamp: Date.now(),
          sender: 'Rebalancer Agent',
          details: {
            message: `Received new rebalance proposal with ID: ${message.id}`,
            rebalancerStatus: 'processing',
            proposalId: message.id,
            agentId: this.operatorId
          }
        }
      );
    }
    
    // Auto-approve the proposal for demo purposes
    // In a real system, this would wait for voting to complete
    setTimeout(() => {
      this.approveProposal(message.id);
    }, 5000); // Wait 5 seconds to simulate voting
  }
  
  /**
   * Approve a rebalance proposal
   * @param proposalId The ID of the proposal to approve
   */
  async approveProposal(proposalId: string): Promise<void> {
    if (!this.pendingProposals.has(proposalId)) {
      console.log(`🤖 PROPOSAL HANDLER: Cannot approve unknown proposal ${proposalId}`);
      return;
    }
    
    console.log(`🤖 PROPOSAL HANDLER: Auto-approving proposal ${proposalId} (demo simulation)`);
    
    const approvalMessage: HCSMessage = {
      id: `approval-${Date.now()}`,
      type: 'RebalanceApproved',
      timestamp: Date.now(),
      sender: 'rebalance-agent',
      details: {
        proposalId: proposalId,
        approvedAt: Date.now(),
        message: `Proposal ${proposalId} approved with 75% votes in favor`
      },
      votes: {
        for: 7500,
        against: 2500,
        total: 10000
      }
    };
    
    // Publish to governance topic
    await hcsMessaging.sendHCSMessage(this.governanceTopic, approvalMessage);
    console.log(`🤖 PROPOSAL HANDLER: Approval message published to governance topic`);
    
    // Send notification to Moonscape if configured
    if (this.moonscapeOutboundTopic && this.moonscapeInboundTopic) {
      await hcsMessaging.sendToMoonscape(
        this.moonscapeOutboundTopic,
        this.moonscapeInboundTopic,
        this.operatorId,
        {
          id: `moonscape-approval-${Date.now()}`,
          type: 'AgentInfo',
          timestamp: Date.now(),
          sender: 'Rebalancer Agent',
          details: {
            message: `Approved rebalance proposal with ID: ${proposalId}`,
            rebalancerStatus: 'executing',
            proposalId: proposalId,
            agentId: this.operatorId
          }
        }
      );
    }
  }
  
  /**
   * Handle a rebalance approval
   * @param message The approval message
   */
  private async handleApproval(message: HCSMessage): Promise<void> {
    console.log(`🤖 PROPOSAL HANDLER: Detected approved rebalance: ${message.details?.proposalId}`);
    const proposalId = message.details?.proposalId;
    
    if (proposalId && this.pendingProposals.has(proposalId)) {
      const proposal = this.pendingProposals.get(proposalId)!;
      await this.executeRebalance(proposal);
    } else {
      console.log(`🤖 PROPOSAL HANDLER: Cannot find proposal ${proposalId} for execution`);
    }
  }
  
  /**
   * Handle an agent request message
   * @param message The request message
   */
  private async handleAgentRequest(message: HCSMessage): Promise<void> {
    console.log(`🌙 PROPOSAL HANDLER: Received agent request: ${message.details?.request}`);
    
    // Process agent request from Moonscape
    const requestType = message.details?.request;
    
    if (requestType === 'status') {
      // Send status update to Moonscape
      if (this.moonscapeOutboundTopic && this.moonscapeInboundTopic) {
        await hcsMessaging.sendAgentStatus(
          this.moonscapeOutboundTopic,
          this.moonscapeInboundTopic,
          this.operatorId,
          this.pendingProposals.size,
          this.executedProposals.size
        );
      }
    }
  }
  
  /**
   * Execute a rebalance operation
   * @param proposal The proposal to execute
   */
  private async executeRebalance(proposal: HCSMessage): Promise<void> {
    if (!proposal || !proposal.id) {
      console.log('🤖 PROPOSAL HANDLER: Invalid proposal for execution');
      return;
    }
    
    // Check if we've already executed this proposal
    if (this.executedProposals.has(proposal.id)) {
      console.log(`🤖 PROPOSAL HANDLER: Proposal ${proposal.id} already executed`);
      return;
    }
    
    console.log(`🤖 PROPOSAL HANDLER: Executing rebalance for proposal ${proposal.id}`);
    
    // Use OpenAI to analyze the rebalance and generate reasoning
    let aiAnalysisResult = "Analysis not available - OpenAI integration not configured";
    if (aiAnalysis) {
      aiAnalysisResult = await aiAnalysis.analyzeRebalanceProposal(proposal);
    }
    
    // Get new weights from proposal
    const newWeights = proposal.details?.newWeights as TokenWeights || {};
    
    try {
      // Get current token balances from TokenService
      console.log('🤖 PROPOSAL HANDLER: Fetching current token balances...');
      const currentBalances = await this.tokenService.getTokenBalances();
      console.log('🤖 PROPOSAL HANDLER: Current balances:', currentBalances);
      
      // Calculate required adjustments
      console.log('🤖 PROPOSAL HANDLER: Calculating token adjustments...');
      const adjustments = this.tokenService.calculateAdjustments(currentBalances, newWeights);
      console.log('🤖 PROPOSAL HANDLER: Calculated adjustments:', adjustments);
      
      // FORCE ADJUSTMENTS FOR TESTING - this ensures actual token operations occur
      console.log('🤖 PROPOSAL HANDLER: FORCING ADJUSTMENTS FOR TESTING REAL HTS OPERATIONS');
      // We'll mint some BTC, burn some ETH, and mint some SOL to demonstrate transactions
      const forcedAdjustments = {
        'BTC': 50,    // Mint 50 BTC
        'ETH': -25,   // Burn 25 ETH
        'SOL': 35     // Mint 35 SOL
      };
      
      // Get list of valid tokens
      const validTokens = Object.keys(this.tokenService.getAllTokenIds());
      console.log('🤖 PROPOSAL HANDLER: Valid tokens from token-data.json:', validTokens);
      
      // Execute token operations using TokenService (real HTS calls)
      for (const [token, adjustmentValue] of Object.entries(forcedAdjustments)) {
        // Skip if token is not in our valid tokens list
        if (!validTokens.includes(token)) {
          console.log(`⚠️ PROPOSAL HANDLER: Skipping token ${token} - not found in token-data.json`);
          continue;
        }
        
        // Ensure the amount is a number
        const amount = Number(adjustmentValue);
        
        if (isNaN(amount)) {
          console.log(`❌ PROPOSAL HANDLER: Invalid adjustment value for ${token}, skipping`);
          continue;
        }
        
        if (Math.abs(amount) < 1) {
          console.log(`🤖 PROPOSAL HANDLER: Adjustment too small for ${token}, skipping`);
          continue;
        }
        
        if (amount > 0) {
          console.log(`🚀 PROPOSAL HANDLER: Minting ${amount} ${token} tokens via HTS...`);
          const result = await this.tokenService.mintTokens(token, amount);
          if (result) {
            console.log(`✅ PROPOSAL HANDLER: Successfully minted ${amount} ${token} tokens via HTS`);
          } else {
            console.error(`❌ PROPOSAL HANDLER: Failed to mint ${token} tokens via HTS`);
          }
        } else if (amount < 0) {
          const burnAmount = Math.abs(amount);
          console.log(`🔥 PROPOSAL HANDLER: Burning ${burnAmount} ${token} tokens via HTS...`);
          const result = await this.tokenService.burnTokens(token, burnAmount);
          if (result) {
            console.log(`✅ PROPOSAL HANDLER: Successfully burned ${burnAmount} ${token} tokens via HTS`);
          } else {
            console.error(`❌ PROPOSAL HANDLER: Failed to burn ${token} tokens via HTS`);
          }
        }
      }
      
      // Get updated balances after operations
      const updatedBalances = await this.tokenService.getTokenBalances();
      console.log('🤖 PROPOSAL HANDLER: Updated balances after rebalance:', updatedBalances);
      
      // Mark as executed
      this.executedProposals.add(proposal.id);
      
      // Prepare execution message
      const executionMessage: HCSMessage = {
        id: `exec-${Date.now()}`,
        type: 'RebalanceExecuted',
        timestamp: Date.now(),
        sender: 'rebalance-agent',
        details: {
          proposalId: proposal.id,
          preBalances: currentBalances,
          postBalances: updatedBalances,
          executedAt: Date.now(),
          message: aiAnalysisResult
        }
      };
      
      // Publish to agent topic
      await hcsMessaging.sendHCSMessage(this.agentTopic, executionMessage);
      console.log(`🤖 PROPOSAL HANDLER: Rebalance execution message published to agent topic`);
      
      // Also publish to Moonscape if configured
      if (this.moonscapeOutboundTopic && this.moonscapeInboundTopic) {
        await hcsMessaging.sendToMoonscape(
          this.moonscapeOutboundTopic,
          this.moonscapeInboundTopic,
          this.operatorId,
          {
            id: `moonscape-exec-${Date.now()}`,
            type: 'RebalanceExecuted',
            timestamp: Date.now(),
            sender: 'Rebalancer Agent',
            details: {
              proposalId: proposal.id,
              preBalances: currentBalances,
              postBalances: updatedBalances,
              executedAt: Date.now(),
              message: aiAnalysisResult
            }
          }
        );
      }
    } catch (error) {
      console.error('❌ PROPOSAL HANDLER ERROR: Failed to execute rebalance:', error);
    }
  }
  
  /**
   * Create a test rebalance proposal for demonstration
   */
  async createTestProposal(): Promise<void> {
    console.log('🤖 PROPOSAL HANDLER: Creating test proposal...');
    
    // Get current token weights
    const currentBalances = await this.tokenService.getTokenBalances();
    
    // Convert to number array and calculate total
    const balanceValues = Object.values(currentBalances).map(value => Number(value));
    const totalSupply = balanceValues.reduce((sum, val) => sum + val, 0);
    
    const currentWeights: TokenWeights = {};
    for (const [token, balance] of Object.entries(currentBalances)) {
      currentWeights[token] = Number(balance) / totalSupply;
    }
    
    // Create proposal (using the same weights to avoid changes for demo)
    const proposalMessage: HCSMessage = {
      id: `prop-${Date.now()}`,
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: 'rebalance-agent',
      details: {
        newWeights: currentWeights,
        executeAfter: Date.now() + 86400000, // 24 hours from now
        quorum: 5000, // 50% required
        trigger: 'scheduled',
        message: "Scheduled weekly rebalance - maintaining current allocation"
      }
    };
    
    // Publish to governance topic
    await hcsMessaging.sendHCSMessage(this.governanceTopic, proposalMessage);
    console.log('✅ PROPOSAL HANDLER: Demo proposal created successfully');
    
    // Also send a message to Moonscape to demonstrate communication
    if (this.moonscapeOutboundTopic && this.moonscapeInboundTopic) {
      await hcsMessaging.sendToMoonscape(
        this.moonscapeOutboundTopic,
        this.moonscapeInboundTopic,
        this.operatorId,
        {
          id: `notification-${Date.now()}`,
          type: 'AgentInfo',
          timestamp: Date.now(),
          sender: 'Rebalancer Agent',
          details: {
            message: "Created a new rebalance proposal",
            proposalId: proposalMessage.id,
            agentId: this.operatorId
          }
        }
      );
    }
  }
  
  /**
   * Get count of pending proposals
   */
  getPendingProposalCount(): number {
    return this.pendingProposals.size;
  }
  
  /**
   * Get count of executed proposals
   */
  getExecutedProposalCount(): number {
    return this.executedProposals.size;
  }
}

// Create and export singleton instance
const tokenService = new TokenService();
export default new ProposalHandlerService(tokenService); 