"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebalanceAgent = void 0;
const base_agent_1 = require("./base-agent");
class RebalanceAgent extends base_agent_1.BaseAgent {
    constructor(hederaService) {
        super({
            id: 'rebalance-agent',
            type: 'rebalance',
            hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID,
                output: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID
            }
        });
        this.currentBalances = new Map();
        this.pendingProposals = new Map();
    }
    async handleMessage(message) {
        switch (message.type) {
            case 'RebalanceProposal':
                await this.handleRebalanceProposal(message);
                break;
            case 'RebalanceApproved':
                await this.handleRebalanceApproval(message);
                break;
            case 'RiskAlert':
                await this.handleRiskAlert(message);
                break;
        }
    }
    async handleRebalanceProposal(proposal) {
        // Store the proposal for later execution
        this.pendingProposals.set(proposal.proposalId, proposal);
        console.log(`Stored rebalance proposal ${proposal.proposalId}`);
    }
    async handleRebalanceApproval(approval) {
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
    async handleRiskAlert(alert) {
        if (alert.severity === 'high') {
            // For high-risk alerts, create an emergency rebalance proposal
            const emergencyProposal = {
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
    async executeRebalance(proposal) {
        try {
            // Simulate rebalancing by updating balances
            const preBalances = new Map(this.currentBalances);
            // Update balances according to new weights
            for (const [tokenId, weight] of Object.entries(proposal.newWeights)) {
                this.currentBalances.set(tokenId, weight * 1000); // Example: scale to 1000 units
            }
            // Publish execution confirmation
            const execution = {
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
        }
        catch (error) {
            console.error(`Error executing rebalance for proposal ${proposal.proposalId}:`, error);
        }
    }
    calculateEmergencyWeights(alert) {
        // In a real implementation, this would use more sophisticated logic
        // For now, we'll just reduce the weight of affected tokens
        const weights = {};
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
exports.RebalanceAgent = RebalanceAgent;
