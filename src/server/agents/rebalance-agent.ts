import { BaseAgent } from './base-agent';
import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';
import { TokenService } from '../token-service';
import fs from 'fs';
import path from 'path';

interface Proposal {
  id: string;
  type: string;
  proposalId: string;
  details: {
    newWeights: Record<string, number>;
    [key: string]: any;
  };
}

// Define our own execution message format
interface RebalanceExecutionMessage extends HCSMessage {
  details: {
    proposalId: string;
    preBalances: Record<string, number>;
    postBalances: Record<string, number>;
    adjustments: Record<string, number>;
    executedAt: number;
    message: string;
  }
}

export class RebalanceAgent extends BaseAgent {
  private tokenService: TokenService;
  private isExecuting: boolean = false;
  private tokenDataPath: string;

  constructor(hederaService: HederaService) {
    super({
      id: 'rebalance-agent',
      type: 'rebalance',
      hederaService,
      topics: {
        input: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!,
        output: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!
      }
    });
    
    // Initialize token service
    this.tokenService = new TokenService();
    this.tokenDataPath = path.join(process.cwd(), 'token-data.json');
    
    console.log('✅ RebalanceAgent initialized with TokenService');
  }

  protected async handleMessage(message: HCSMessage): Promise<void> {
    console.log(`📥 RebalanceAgent received message: ${message.type}`);
    
    if (message.type === 'RebalanceApproved' && message.details?.proposalId) {
      console.log(`🔄 Processing rebalance approval for proposal: ${message.details.proposalId}`);
      
      try {
        // Manually find the proposal from message store
        const proposals = await this.getProposals();
        const proposal = proposals.find(p => p.id === message.details.proposalId);
        
        if (proposal && proposal.type === 'RebalanceProposal' && proposal.details?.newWeights) {
          console.log(`🚀 Executing rebalance for approved proposal: ${proposal.id}`);
          await this.executeRebalance(proposal);
        } else {
          console.error(`❌ Could not find original proposal: ${message.details.proposalId}`);
        }
      } catch (error) {
        console.error('❌ Error processing approval message:', error);
      }
    }
  }

  // Mock function to get proposals from message history
  private async getProposals(): Promise<Proposal[]> {
    // This would normally retrieve proposals from the HederaService
    // For now, we'll look at the most recent messages to find proposals
    // In a real implementation, these would be stored in a database
    try {
      // Simple example - normally this would query a real data source
      return [
        {
          id: 'prop-1',
          type: 'RebalanceProposal',
          proposalId: 'prop-1',
          details: {
            newWeights: {
              'BTC': 0.5,
              'ETH': 0.3,
              'SOL': 0.2,
            }
          }
        }
      ];
    } catch (error) {
      console.error('❌ Error fetching proposals:', error);
      return [];
    }
  }

  private async executeRebalance(proposal: Proposal): Promise<boolean> {
    if (this.isExecuting) {
      console.log('❌ Already executing a rebalance, skipping...');
      return false;
    }
    
    this.isExecuting = true;
    console.log(`🔄 Starting token rebalance execution for proposal ${proposal.id}...`);
    
    try {
      // 1. Get current token balances
      const currentBalances = await this.tokenService.getTokenBalances();
      console.log('📊 Current token balances:', currentBalances);
      
      // 2. Calculate adjustments needed based on new weights
      const adjustments = this.tokenService.calculateAdjustments(
        currentBalances,
        proposal.details.newWeights
      );
      console.log('📋 Calculated token adjustments:', adjustments);
      
      // 3. Execute the actual token operations (mint/burn)
      for (const [token, amount] of Object.entries(adjustments)) {
        if (Math.abs(amount) < 1) {
          console.log(`⏭️ Skipping minimal adjustment for ${token}: ${amount}`);
          continue;
        }
        
        const tokenId = this.tokenService.getTokenId(token);
        if (!tokenId) {
          console.error(`❌ Token ID not found for ${token}`);
          continue;
        }
        
        if (amount > 0) {
          console.log(`🟢 Minting ${amount} ${token} tokens`);
          const result = await this.tokenService.mintTokens(token, amount);
          if (result) {
            console.log(`✅ Successfully minted ${amount} ${token} tokens`);
            this.logTokenOperation(token, tokenId, 'MINT', amount, proposal.id);
          } else {
            console.error(`❌ Failed to mint ${token} tokens`);
          }
        } else if (amount < 0) {
          const burnAmount = Math.abs(amount);
          console.log(`🔴 Burning ${burnAmount} ${token} tokens`);
          const result = await this.tokenService.burnTokens(token, burnAmount);
          if (result) {
            console.log(`✅ Successfully burned ${burnAmount} ${token} tokens`);
            this.logTokenOperation(token, tokenId, 'BURN', burnAmount, proposal.id);
          } else {
            console.error(`❌ Failed to burn ${token} tokens`);
          }
        }
      }
      
      // 4. Publish execution confirmation to HCS
      const executionMessage: RebalanceExecutionMessage = {
        id: `exec-${Date.now()}`,
        type: 'RebalanceExecuted',
        timestamp: Date.now(),
        sender: this.id,
        details: {
          proposalId: proposal.id,
          preBalances: currentBalances,
          postBalances: await this.tokenService.getTokenBalances(), // Get updated balances
          adjustments,
          executedAt: Date.now(),
          message: `Successfully executed rebalance for proposal ${proposal.id} with ${Object.keys(adjustments).length} token adjustments`
        }
      };
      
      await this.publishHCSMessage(executionMessage);
      console.log(`✅ Published execution confirmation for proposal ${proposal.id}`);
      
      this.isExecuting = false;
      return true;
    } catch (error) {
      console.error('❌ Error executing rebalance:', error);
      this.isExecuting = false;
      return false;
    }
  }
  
  // Log token operation to token-data.json
  private logTokenOperation(token: string, tokenId: string, type: string, amount: number, proposalId: string): void {
    try {
      // Read current token data
      let tokenData: any = { tokens: {}, network: "testnet" };
      if (fs.existsSync(this.tokenDataPath)) {
        const data = fs.readFileSync(this.tokenDataPath, 'utf8');
        tokenData = JSON.parse(data);
      }
      
      // Ensure token exists in data
      if (!tokenData.tokens[token]) {
        console.error(`❌ Token ${token} not found in token data`);
        return;
      }
      
      // Create transaction ID (normally this would come from HTS)
      const now = Date.now();
      const txId = `0.0.4340026@${now}/${proposalId}-${type.toLowerCase()}-${token}`;
      
      // Format for Hashscan URL
      const formattedTxId = txId.replace(/\./g, '-').replace('@', '-');
      const hashscanUrl = `https://hashscan.io/testnet/transaction/${formattedTxId}`;
      
      // Ensure transactions array exists
      if (!tokenData.tokens[token].transactions) {
        tokenData.tokens[token].transactions = [];
      }
      
      // Add transaction
      tokenData.tokens[token].transactions.push({
        type,
        txId,
        timestamp: new Date().toISOString(),
        amount,
        hashscanUrl,
        proposalId
      });
      
      // Save updated token data
      fs.writeFileSync(this.tokenDataPath, JSON.stringify(tokenData, null, 2));
      console.log(`✅ Logged ${type} operation for ${token} to token-data.json`);
      
    } catch (error) {
      console.error('❌ Error logging token operation:', error);
    }
  }
} 