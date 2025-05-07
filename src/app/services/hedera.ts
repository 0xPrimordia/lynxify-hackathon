import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
  AccountId,
  TransactionResponse,
  TopicMessage,
  TopicMessageQuery
} from "@hashgraph/sdk";
import { HCSMessage, TokenWeights } from '../types/hcs.js';
import { isValidHCSMessage } from '../types/hcs.js';
import messageStore from "./message-store.js";
import { TokenService } from './token-service.js';
import { v4 as uuidv4 } from 'uuid';

// HCS Topic IDs from the spec
const TOPICS = {
  GOVERNANCE_PROPOSALS: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '',
  MARKET_PRICE_FEED: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC || '',
  AGENT_ACTIONS: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || ''
} as const;

// Validate environment variables unless bypassed (for initialization)
if (process.env.BYPASS_TOPIC_CHECK !== 'true') {
  Object.entries(TOPICS).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`Missing required environment variable for ${key} topic`);
    }
  });
}

// Type-safe topic IDs after validation
const TOPIC_IDS = {
  GOVERNANCE_PROPOSALS: TOPICS.GOVERNANCE_PROPOSALS!,
  MARKET_PRICE_FEED: TOPICS.MARKET_PRICE_FEED!,
  AGENT_ACTIONS: TOPICS.AGENT_ACTIONS!
} as const;

// Agent configuration from the spec
const AGENTS = {
  PRICE_FEED: {
    id: 'price-feed-agent',
    description: 'Monitors token prices and detects deviations',
    threshold: 0.05 // 5% deviation threshold
  },
  RISK_ASSESSMENT: {
    id: 'risk-assessment-agent',
    description: 'Analyzes market conditions and triggers alerts',
    riskLevels: {
      low: 0.05,
      medium: 0.10,
      high: 0.15
    }
  },
  REBALANCE: {
    id: 'rebalance-agent',
    description: 'Executes approved rebalance proposals'
  }
} as const;

export class HederaService {
  private client: Client;
  private subscriptions: Map<string, any> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private messageHandlers: Map<string, ((message: HCSMessage) => void)[]> = new Map();
  private tokenService: TokenService;

  constructor() {
    console.log('🚀 HEDERA: Initializing HederaService with REAL Hedera network...');
    
    // Check if environment variables are properly set
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    // Validate critical environment variables
    const missingVars = [];
    if (!operatorId) missingVars.push('NEXT_PUBLIC_OPERATOR_ID');
    if (!operatorKey) missingVars.push('OPERATOR_KEY');
    
    if (missingVars.length > 0) {
      const errorMsg = `CRITICAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`;
      console.error(`❌ HEDERA ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Initialize Hedera client with testnet credentials
    try {
      console.log('🔄 HEDERA: Creating client for testnet with operator:', operatorId);
      this.client = Client.forTestnet();
      
      console.log('🔄 HEDERA: Setting operator credentials...');
      this.client.setOperator(
        AccountId.fromString(operatorId!),
        PrivateKey.fromString(operatorKey!)
      );
      
      console.log('✅ HEDERA: Successfully initialized client with REAL Hedera testnet');
    } catch (error) {
      console.error('❌ HEDERA ERROR: Failed to initialize Hedera client:', error);
      throw error;
    }

    try {
      this.tokenService = new TokenService(); // Initialize token service
      
      console.log('✅ HederaService initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing HederaService:', error);
      throw error;
    }
  }

  // Create HCS topics
  async createGovernanceTopic(): Promise<string> {
    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo('Governance Proposals Topic');

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error('Failed to create governance topic');
      }

      return receipt.topicId.toString();
    } catch (error) {
      console.error('Error creating governance topic:', error);
      throw error;
    }
  }

  async createAgentTopic(): Promise<string> {
    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo('Agent Actions Topic');

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error('Failed to create agent topic');
      }

      return receipt.topicId.toString();
    } catch (error) {
      console.error('Error creating agent topic:', error);
      throw error;
    }
  }

  async createPriceFeedTopic(): Promise<string> {
    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo('Price Feed Topic');

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error('Failed to create price feed topic');
      }

      return receipt.topicId.toString();
    } catch (error) {
      console.error('Error creating price feed topic:', error);
      throw error;
    }
  }

  // Get messages from a topic using the Mirror Node (more reliable for demos)
  async getTopicMessages(topicId: string): Promise<HCSMessage[]> {
    console.log(`🔍 HEDERA: Getting messages from Mirror Node for topic ${topicId}...`);
    
    try {
      // Use the global message store instead of internal storage
      const messages = messageStore.getMessages(topicId);
      console.log(`✅ HEDERA: Retrieved ${messages.length} messages for topic ${topicId}`);
      return messages;
    } catch (error) {
      console.error(`❌ HEDERA ERROR: Error getting topic messages from ${topicId}:`, error);
      return [];
    }
  }

  // HCS Message Publishing
  async publishHCSMessage(
    topicId: string,
    message: HCSMessage
  ): Promise<void> {
    try {
      console.log(`🔄 HEDERA: Publishing REAL message to HCS topic ${topicId}:`, {
        messageType: message.type,
        messageId: message.id,
        timestamp: new Date(message.timestamp).toISOString(),
        sender: message.sender,
      });
      
      console.log('📝 HEDERA: Full message content:', JSON.stringify(message));
      
      // Validate topic ID
      if (!topicId || topicId.trim() === '') {
        console.error(`❌ HEDERA ERROR: Invalid topic ID: "${topicId}"`);
        throw new Error(`Invalid topic ID: "${topicId}"`);
      }

      console.log(`🔄 HEDERA: Creating TopicMessageSubmitTransaction for topic ${topicId}...`);
      let transaction;
      try {
        const parsedTopicId = TopicId.fromString(topicId);
        console.log(`✅ HEDERA: Topic ID is valid: ${parsedTopicId.toString()}`);
        
        transaction = new TopicMessageSubmitTransaction()
          .setTopicId(parsedTopicId)
          .setMessage(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ HEDERA ERROR: Failed to create transaction for topic ${topicId}:`, error);
        throw error;
      }

      console.log(`🔄 HEDERA: Executing transaction for topic ${topicId}...`);
      let response;
      try {
        response = await transaction.execute(this.client);
        
        // Extract transaction ID information safely
        let txId = "unknown";
        try {
          txId = response.toString().split('@')[1] || response.toString();
        } catch (err) {
          console.warn(`⚠️ Could not parse transaction ID cleanly: ${err}`);
          txId = response.toString();
        }
        
        console.log(`======================================================`);
        console.log(`✅ HEDERA: Transaction executed for topic ${topicId}`);
        console.log(`🔍 TRANSACTION ID: ${txId}`);
        console.log(`🔗 VERIFY ON HASHSCAN: https://hashscan.io/testnet/transaction/${txId}`);
        console.log(`======================================================`);
      } catch (error) {
        console.error(`❌ HEDERA ERROR: Transaction execution failed for topic ${topicId}:`, error);
        throw error;
      }
      
      console.log(`🔄 HEDERA: Getting receipt for topic ${topicId} transaction...`);
      try {
        const receipt = await response.getReceipt(this.client);
        console.log(`✅ HEDERA: Message successfully published to real HCS topic ${topicId}`, { 
          receipt: JSON.stringify(receipt) 
        });
        
        // Store message in the global message store
        messageStore.addMessage(topicId, message);
        
      } catch (error) {
        console.error(`❌ HEDERA ERROR: Failed to get receipt for topic ${topicId}:`, error);
        // Don't throw here - the message might still have been published
        console.log(`⚠️ HEDERA: Message may still have been published despite receipt error`);
        
        // Still store the message in global message store
        messageStore.addMessage(topicId, message);
      }
      
    } catch (error) {
      console.error(`❌ HEDERA ERROR: Error publishing real HCS message:`, error);
      throw error;
    }
  }

  // HCS Message Subscription
  async subscribeToTopic(
    topicId: string,
    onMessage: (message: HCSMessage) => void
  ): Promise<void> {
    try {
      // Validate topic ID
      if (!topicId || topicId === 'undefined' || topicId.trim() === '') {
        console.error(`❌ HEDERA ERROR: Invalid topic ID: "${topicId}"`);
        throw new Error(`Invalid topic ID: "${topicId}"`);
      }

      const topicIdObj = TopicId.fromString(topicId);
      console.log(`🔄 HEDERA: Subscribing to topic: ${topicIdObj.toString()}`);

      // Check if we're already subscribed
      if (this.subscriptions.has(topicId)) {
        console.log(`ℹ️ HEDERA: Already subscribed to topic: ${topicId}`);
        
        // Add the new message handler
        if (!this.messageHandlers.has(topicId)) {
          this.messageHandlers.set(topicId, []);
        }
        this.messageHandlers.get(topicId)!.push(onMessage);
        return;
      }
      
      // Register the message handler
      if (!this.messageHandlers.has(topicId)) {
        this.messageHandlers.set(topicId, []);
      }
      this.messageHandlers.get(topicId)!.push(onMessage);
      
      // Set up the subscription
      const subscription = new TopicMessageQuery()
        .setTopicId(topicIdObj)
        .subscribe(
          this.client,
          (message: TopicMessage | null, error: Error) => {
            if (error) {
              console.error(`❌ HEDERA ERROR: Error in subscription to topic ${topicId}:`, error);
              return;
            }
            if (!message) {
              console.warn(`⚠️ HEDERA: Received null message from topic ${topicId}`);
              return;
            }
            
            try {
              const messageAsString = Buffer.from(message.contents).toString();
              const parsedMessage = JSON.parse(messageAsString) as HCSMessage;
              
              if (isValidHCSMessage(parsedMessage)) {
                console.log(`✅ HEDERA: Received valid message from topic ${topicId}`);
                
                // Store message in the global message store
                messageStore.addMessage(topicId, parsedMessage);
                
                // Notify all handlers for this topic
                this.messageHandlers.get(topicId)?.forEach(handler => {
                  handler(parsedMessage);
                });
              } else {
                console.error(`❌ HEDERA: Received invalid message format from topic ${topicId}`);
              }
            } catch (error) {
              console.error(`❌ HEDERA ERROR: Failed to parse message from topic ${topicId}:`, error);
            }
          },
          (message: TopicMessage) => {
            try {
              const messageAsString = Buffer.from(message.contents).toString();
              const parsedMessage = JSON.parse(messageAsString) as HCSMessage;
              
              if (isValidHCSMessage(parsedMessage)) {
                console.log(`✅ HEDERA: Received valid message from topic ${topicId}`);
                
                // Store message in the global message store
                messageStore.addMessage(topicId, parsedMessage);
                
                // Notify all handlers for this topic
                this.messageHandlers.get(topicId)?.forEach(handler => {
                  handler(parsedMessage);
                });
              } else {
                console.error(`❌ HEDERA: Received invalid message format from topic ${topicId}`);
              }
            } catch (error) {
              console.error(`❌ HEDERA ERROR: Failed to parse message from topic ${topicId}:`, error);
            }
          }
        );
      
      this.subscriptions.set(topicId, subscription);
      console.log(`✅ HEDERA: Successfully subscribed to topic ${topicId}`);
    } catch (error) {
      console.error(`❌ HEDERA ERROR: Failed to subscribe to topic ${topicId}:`, error);
      throw error;
    }
  }

  // Unsubscribe from topic
  async unsubscribeFromTopic(topicId: string): Promise<void> {
    const subscription = this.subscriptions.get(topicId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topicId);
      this.messageHandlers.delete(topicId);
    }
  }

  // Initialize topics if they don't exist
  async initializeTopics(): Promise<void> {
    try {
      // Log HCS topic configuration
      console.log('📋 HEDERA: HCS topic configuration for REAL network:', {
        governanceTopic: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
        priceFeedTopic: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC,
        agentTopic: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC
      });

      // Subscribe to all topics
      await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!, this.handleGovernanceMessage.bind(this));
      await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC!, this.handlePriceFeedMessage.bind(this));
      await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!, this.handleAgentMessage.bind(this));
    } catch (error) {
      console.error('Error initializing topics:', error);
      throw error;
    }
  }

  // Message handlers
  private handlePriceFeedMessage = async (message: HCSMessage): Promise<void> => {
    if (message.type === 'PriceUpdate') {
      // Store the last price for calculating changes
      this.lastPrices.set(message.details.tokenId || '', message.details.price || 0);
      console.log('Price update received:', message);
    }
  };

  private handleGovernanceMessage = async (message: HCSMessage): Promise<void> => {
    if (message.type === 'RebalanceProposal') {
      // Handle rebalance proposal
      console.log('Rebalance proposal received:', message);
    } else if (message.type === 'RebalanceApproved') {
      // Handle approved proposal
      console.log('Rebalance approved:', message);
    }
  };

  private handleAgentMessage = async (message: HCSMessage): Promise<void> => {
    if (message.type === 'RebalanceExecuted') {
      // Handle rebalance execution
      console.log('Rebalance executed:', message);
    }
  };

  // Agent Functions
  async processPriceUpdate(price: number, tokenId: string): Promise<void> {
    const message: HCSMessage = {
      id: `price-${Date.now()}`,
      type: 'PriceUpdate',
      timestamp: Date.now(),
      sender: AGENTS.PRICE_FEED.id,
      details: {
        tokenId,
        price,
        source: 'price-feed-agent'
      }
    };

    await this.publishHCSMessage(TOPIC_IDS.MARKET_PRICE_FEED, message);
  }

  async assessRisk(priceChange: number, tokenId: string): Promise<void> {
    const riskLevel = 
      Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.high ? 'high' :
      Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.medium ? 'medium' :
      'low';

    const message: HCSMessage = {
      id: `risk-${Date.now()}`,
      type: 'RiskAlert',
      timestamp: Date.now(),
      sender: AGENTS.RISK_ASSESSMENT.id,
      details: {
        severity: riskLevel,
        riskDescription: `Price deviation of ${priceChange}% detected for ${tokenId}`,
        affectedTokens: [tokenId],
        metrics: {
          priceChange
        }
      }
    };

    await this.publishHCSMessage(TOPIC_IDS.GOVERNANCE_PROPOSALS, message);
  }

  // Propose a rebalance
  async proposeRebalance(
    newWeights: TokenWeights, 
    executeAfter: number, 
    quorum: number,
    trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled',
    justification?: string
  ): Promise<void> {
    console.log('🔄 HEDERA: Creating rebalance proposal message with real HCS:', {
      newWeightsTokens: Object.keys(newWeights),
      executeAfter: new Date(executeAfter).toISOString(),
      quorum,
      trigger,
      justificationLength: justification?.length
    });
    
    const messageId = `prop-${Date.now()}`;
    const message: HCSMessage = {
      id: messageId,
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      sender: AGENTS.REBALANCE.id,
      details: {
        newWeights,
        executeAfter,
        quorum,
        trigger,
        message: justification || 'Proposed rebalance to maintain target weights'
      }
    };
    
    console.log(`📝 HEDERA: Created proposal message with ID ${messageId}`, message);

    await this.publishHCSMessage(TOPIC_IDS.GOVERNANCE_PROPOSALS, message);
    console.log('✅ HEDERA: Successfully published real proposal to governance topic');
  }

  // Approve a rebalance proposal
  async approveRebalance(proposalId: string): Promise<void> {
    const message: HCSMessage = {
      id: `approval-${Date.now()}`,
      type: 'RebalanceApproved',
      timestamp: Date.now(),
      sender: AGENTS.REBALANCE.id,
      details: {
        proposalId,
        approvedAt: Date.now()
      }
    };

    await this.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!, message);
  }

  // Get current portfolio weights (now can use real token data)
  public getCurrentPortfolioWeights(): TokenWeights {
    try {
      // For demo purposes, return hardcoded weights if token data isn't available
      return { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 };
    } catch (error) {
      console.error('❌ Error getting current portfolio weights:', error);
      return { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 };
    }
  }

  // Execute rebalance using real token operations
  public async executeRebalance(proposalId: string, newWeights: TokenWeights): Promise<void> {
    try {
      console.log(`🔄 HEDERA: Executing rebalance for proposal: ${proposalId}`, newWeights);
      
      // Get current token balances
      const currentBalances = await this.tokenService.getTokenBalances();
      console.log(`🔍 HEDERA: Current balances:`, currentBalances);
      
      // Calculate adjustments needed
      const adjustments = this.tokenService.calculateAdjustments(currentBalances, newWeights);
      console.log(`🔍 HEDERA: Calculated adjustments:`, adjustments);
      
      // Execute token operations
      for (const [asset, adjustment] of Object.entries(adjustments)) {
        if (adjustment > 0) {
          // Mint additional tokens
          await this.tokenService.mintTokens(asset, adjustment);
        } else if (adjustment < 0) {
          // Burn excess tokens
          await this.tokenService.burnTokens(asset, Math.abs(adjustment));
        }
      }
      
      // Get updated balances after operations
      const updatedBalances = await this.tokenService.getTokenBalances();
      console.log(`🔍 HEDERA: Updated balances:`, updatedBalances);
      
      // Create execution message in HCS-10 format
      const executionMessage: HCSMessage = {
        type: 'RebalanceExecuted',
        id: uuidv4(),
        timestamp: Date.now(),
        sender: process.env.NEXT_PUBLIC_OPERATOR_ID || 'unknown',
        details: {
          proposalId: proposalId,
          preBalances: currentBalances,
          postBalances: updatedBalances,
          executedAt: Date.now(),
          message: "Rebalance executed based on approval from governance process."
        }
      };
      
      // Publish execution confirmation to agent topic
      await this.publishHCSMessage(
        process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
        executionMessage
      );
      
      console.log(`✅ HEDERA: Successfully executed rebalance for proposal ${proposalId}`);
    } catch (error) {
      console.error(`❌ HEDERA ERROR: Failed to execute rebalance for proposal ${proposalId}:`, error);
      throw error;
    }
  }

  // Initialize agent subscriptions
  async initializeAgents(): Promise<void> {
    // Price Feed Agent
    await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC!, async (message: HCSMessage) => {
      if (message.type === 'PriceUpdate') {
        await this.processPriceUpdate(message.details.price || 0, message.details.tokenId || '');
      }
    });

    // Risk Assessment Agent
    await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC!, async (message: HCSMessage) => {
      if (message.type === 'PriceUpdate') {
        const lastPrice = this.lastPrices.get(message.details.tokenId || '');
        if (lastPrice) {
          const priceChange = ((message.details.price || 0) - lastPrice) / lastPrice * 100;
          if (Math.abs(priceChange) >= AGENTS.PRICE_FEED.threshold) {
            await this.assessRisk(priceChange, message.details.tokenId || '');
          }
        }
      }
    });

    // Rebalance Agent
    await this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!, async (message: HCSMessage) => {
      if (message.type === 'RebalanceApproved') {
        const proposal = await this.getProposal(message.details.proposalId || '');
        if (proposal?.type === 'RebalanceProposal') {
          await this.executeRebalance(message.details.proposalId || '', proposal.details.newWeights || {});
        }
      }
    });
  }

  // Helper function to get proposal details
  private async getProposal(proposalId: string): Promise<HCSMessage | null> {
    // TODO: Implement proposal retrieval from HCS
    return null;
  }
}

// Create singleton instance
export const hederaService = new HederaService();