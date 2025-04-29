import { BaseAgent } from './base-agent';
import { HCSMessage, RebalanceProposal, RebalanceApproved, RebalanceExecuted, RiskAlert } from '../../types/hcs';
import { HederaService } from '../hedera';

export class RebalanceAgent extends BaseAgent {
  private currentBalances: Map<string, number> = new Map();
  private pendingProposals: Map<string, RebalanceProposal> = new Map();

  constructor(hederaService: HederaService) {
    super({
      id: 'rebalance-agent',
      type: 'rebalance',
      hederaService,
      topics: {
        input: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!,
        output: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID!
      }
    });
  }

  protected async handleMessage(message: HCSMessage): Promise<void> {
    switch (message.type) {
      case 'RebalanceProposal':
        await this.handleRebalanceProposal(message as RebalanceProposal);
        break;
      case 'RebalanceApproved':
        await this.handleRebalanceApproval(message as RebalanceApproved);
        break;
      case 'RiskAlert':
        await this.handleRiskAlert(message as RiskAlert);
        break;
    }
  }

  private async handleRebalanceProposal(proposal: RebalanceProposal): Promise<void> {
    // Store the proposal for later execution
    this.pendingProposals.set(proposal.proposalId, proposal);
    console.log(`Stored rebalance proposal ${proposal.proposalId}`);
  }

  private async handleRebalanceApproval(approval: RebalanceApproved): Promise<void> {
    const proposal = this.pendingProposals.get(approval.proposalId);
    if (!proposal) {
      console.error(`No proposal found for approval ${approval.proposalId}`);
      return;
    }

    // Execute the rebalance
    await this.executeRebalance(proposal);
    
    // Remove the executed proposal
    this.pendingProposals.delete(approval.proposalId);
  }

  private async handleRiskAlert(alert: RiskAlert): Promise<void> {
    if (alert.severity === 'high') {
      // For high-risk alerts, create an emergency rebalance proposal
      const emergencyProposal: RebalanceProposal = {
        type: 'RebalanceProposal',
        timestamp: Date.now(),
        sender: this.id,
        proposalId: `emergency-${Date.now()}`,
        newWeights: this.calculateEmergencyWeights(alert),
        executeAfter: Date.now(), // Execute immediately
        quorum: 1, // Emergency proposals require minimal quorum
        description: `Emergency rebalance triggered by risk alert: ${alert.description}`
      };

      await this.publishHCSMessage(emergencyProposal);
    }
  }

  private async executeRebalance(proposal: RebalanceProposal): Promise<void> {
    try {
      // Simulate rebalancing by updating balances
      const preBalances = new Map(this.currentBalances);
      
      // Update balances according to new weights
      for (const [tokenId, weight] of Object.entries(proposal.newWeights)) {
        this.currentBalances.set(tokenId, weight * 1000); // Example: scale to 1000 units
      }

      // Publish execution confirmation
      const execution: RebalanceExecuted = {
        type: 'RebalanceExecuted',
        timestamp: Date.now(),
        sender: this.id,
        proposalId: proposal.proposalId,
        preBalances: Object.fromEntries(preBalances),
        postBalances: Object.fromEntries(this.currentBalances),
        executedAt: Date.now(),
        executedBy: this.id
      };

      await this.publishHCSMessage(execution);
      console.log(`Rebalance executed for proposal ${proposal.proposalId}`);
    } catch (error) {
      console.error(`Error executing rebalance for proposal ${proposal.proposalId}:`, error);
    }
  }

  private calculateEmergencyWeights(alert: RiskAlert): { [tokenId: string]: number } {
    // In a real implementation, this would use more sophisticated logic
    // For now, we'll just reduce the weight of affected tokens
    const weights: { [tokenId: string]: number } = {};
    
    alert.affectedTokens.forEach(tokenId => {
      weights[tokenId] = 0.1; // Reduce to 10% weight
    });

    // Distribute remaining weight among other tokens
    const remainingWeight = 1 - (0.1 * alert.affectedTokens.length);
    const otherTokens = Array.from(this.currentBalances.keys())
      .filter(id => !alert.affectedTokens.includes(id));
    
    if (otherTokens.length > 0) {
      const weightPerToken = remainingWeight / otherTokens.length;
      otherTokens.forEach(tokenId => {
        weights[tokenId] = weightPerToken;
      });
    }

    return weights;
  }
} 