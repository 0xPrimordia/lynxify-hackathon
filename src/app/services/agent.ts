import { HederaService } from './hedera';
import { AIService } from './ai';
import type { HCSMessage, RebalanceExecuted } from '../types/hcs';

interface TokenBalance {
  token: string;
  amount: number;
  value: number;
}

// Mock data for the prototype
const MOCK_TOKENS = {
  HBAR: {
    symbol: "HBAR",
    price: 0.12,
    volume24h: 50000000,
    liquidityDepth: 25000000
  },
  USDC: {
    symbol: "USDC",
    price: 1.00,
    volume24h: 100000000,
    liquidityDepth: 50000000
  },
  ETH: {
    symbol: "ETH",
    price: 3500.00,
    volume24h: 75000000,
    liquidityDepth: 35000000
  }
};

export abstract class Agent {
  protected hederaService: HederaService;
  protected isRunning: boolean = false;

  constructor(hederaService: HederaService) {
    this.hederaService = hederaService;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!;
    const agentTopicId = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID!;

    await this.hederaService.subscribeToTopic(governanceTopicId, (message: HCSMessage) => {
      this.handleMessage(message).catch(error => {
        console.error('Error handling message:', error);
      });
    });

    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Agent is not running');
    }

    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!;
    await this.hederaService.unsubscribeFromTopic(governanceTopicId);

    this.isRunning = false;
  }

  protected abstract handleMessage(message: HCSMessage): Promise<void>;

  protected async publishMessage(message: HCSMessage): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Agent is not running');
    }

    const agentTopicId = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID!;
    await this.hederaService.publishHCSMessage(agentTopicId, message);
  }

  protected async publishRebalanceExecuted(proposalId: string, preBalances: Record<string, number>, postBalances: Record<string, number>): Promise<void> {
    const message: RebalanceExecuted = {
      id: `exec-${Date.now()}`,
      type: 'RebalanceExecuted',
      timestamp: Date.now(),
      sender: 'agent',
      details: {
        proposalId,
        preBalances,
        postBalances,
        executedAt: Date.now()
      }
    };

    await this.publishMessage(message);
  }
}

export class RebalanceAgent extends Agent {
  private aiService: AIService;
  private currentBalances: TokenBalance[] = [];

  constructor(hederaService: HederaService) {
    super(hederaService);
    this.aiService = new AIService();
  }

  protected async handleMessage(message: HCSMessage): Promise<void> {
    switch (message.type) {
      case 'RebalanceProposal':
        // Store proposal for later execution
        console.log('Received rebalance proposal:', message);
        break;

      case 'RebalanceApproved':
        // Execute the approved rebalance
        if (message.details?.proposalId) {
          await this.executeRebalance(message.details.proposalId);
        } else {
          console.error('RebalanceApproved message is missing proposalId in details');
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async executeRebalance(proposalId: string) {
    try {
      // Get current market data
      const marketData = await this.fetchMarketData();
      
      // Get current token balances
      const currentBalances = await this.fetchTokenBalances();
      this.currentBalances = currentBalances;

      // Calculate current weights
      const currentWeights = this.calculateWeights(currentBalances);

      // Get AI analysis and decisions
      const decisions = await this.aiService.analyzeMarketAndDecideRebalance(
        currentWeights,
        marketData
      );

      // Execute the rebalancing trades
      const postBalances = await this.executeTrades(decisions);

      // Publish execution result to agent topic
      await this.publishRebalanceExecuted(proposalId, this.currentBalances.reduce((acc, balance) => ({
        ...acc,
        [balance.token]: balance.amount
      }), {}), postBalances.reduce((acc, balance) => ({
        ...acc,
        [balance.token]: balance.amount
      }), {}));

      console.log('Rebalance executed and logged:', proposalId);
    } catch (error) {
      console.error('Failed to execute rebalance:', error);
      throw error;
    }
  }

  private async fetchMarketData() {
    // Mock market data for the prototype
    return Object.values(MOCK_TOKENS).map(token => ({
      token: token.symbol,
      price: token.price,
      volume24h: token.volume24h,
      liquidityDepth: token.liquidityDepth,
      lastUpdated: Date.now()
    }));
  }

  private async fetchTokenBalances(): Promise<TokenBalance[]> {
    // Mock token balances for the prototype
    return [
      {
        token: "HBAR",
        amount: 1000000, // 1M HBAR
        value: 1000000 * MOCK_TOKENS.HBAR.price
      },
      {
        token: "USDC",
        amount: 500000, // 500K USDC
        value: 500000 * MOCK_TOKENS.USDC.price
      },
      {
        token: "ETH",
        amount: 100, // 100 ETH
        value: 100 * MOCK_TOKENS.ETH.price
      }
    ];
  }

  private calculateWeights(balances: TokenBalance[]): Record<string, number> {
    const totalValue = balances.reduce((sum, balance) => sum + balance.value, 0);
    return balances.reduce((weights, balance) => ({
      ...weights,
      [balance.token]: (balance.value / totalValue) * 100
    }), {});
  }

  private async executeTrades(decisions: { token: string; targetWeight: number; reason: string }[]): Promise<TokenBalance[]> {
    // Mock trade execution for the prototype
    const totalValue = this.currentBalances.reduce((sum, balance) => sum + balance.value, 0);
    
    return decisions.map(decision => {
      const targetValue = (decision.targetWeight / 100) * totalValue;
      const token = MOCK_TOKENS[decision.token as keyof typeof MOCK_TOKENS];
      const amount = targetValue / token.price;
      
      return {
        token: decision.token,
        amount,
        value: targetValue
      };
    });
  }
} 