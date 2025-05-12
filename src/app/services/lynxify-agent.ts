import { EventBus, EventType } from '../utils/event-emitter';
import { SharedHederaService } from './shared-hedera-service';
import { HCSMessage } from '../types/hcs';
import { HCS10ProtocolService, HCS10ProtocolConfig } from './hcs10-protocol';
import { TokenizedIndexService, TokenizedIndexConfig } from './tokenized-index';

/**
 * Configuration options for the LynxifyAgent
 */
export interface LynxifyAgentConfig {
  agentId: string;
  hederaConfig: {
    network: 'testnet' | 'mainnet' | 'custom';
    operatorId?: string;
    operatorKey?: string;
    customNetwork?: Record<string, string>;
  };
  hcs10Config: {
    registryTopicId: string;
    agentTopicId?: string;
    capabilities?: string[];
    description?: string;
  };
  indexConfig: {
    indexTopicId: string;
    proposalTimeoutMs?: number;
    rebalanceThreshold?: number;
    riskThreshold?: number;
  };
  logEvents?: boolean;
}

/**
 * The unified LynxifyAgent that coordinates the HCS10 protocol and
 * tokenized index functionality using the shared event system.
 */
export class LynxifyAgent {
  private readonly eventBus: EventBus;
  private readonly hederaService: SharedHederaService;
  private readonly config: LynxifyAgentConfig;
  private readonly hcs10Service: HCS10ProtocolService;
  private readonly indexService: TokenizedIndexService;
  private initialized: boolean = false;
  private isInitializing: boolean = false;
  private isShuttingDown: boolean = false;

  /**
   * Create a new LynxifyAgent instance
   * @param config Agent configuration options
   */
  constructor(config: LynxifyAgentConfig) {
    this.config = config;
    this.eventBus = EventBus.getInstance();
    
    // Initialize the shared Hedera service
    this.hederaService = new SharedHederaService({
      network: config.hederaConfig.network,
      operatorId: config.hederaConfig.operatorId,
      operatorKey: config.hederaConfig.operatorKey,
      customNetwork: config.hederaConfig.customNetwork
    });
    
    // Initialize the HCS10 Protocol service
    this.hcs10Service = new HCS10ProtocolService(
      this.hederaService,
      {
        agentId: config.agentId,
        registryTopicId: config.hcs10Config.registryTopicId,
        agentTopicId: config.hcs10Config.agentTopicId,
        capabilities: config.hcs10Config.capabilities,
        description: config.hcs10Config.description
      }
    );
    
    // Initialize the Tokenized Index service
    this.indexService = new TokenizedIndexService(
      this.hederaService,
      {
        indexTopicId: config.indexConfig.indexTopicId,
        proposalTimeoutMs: config.indexConfig.proposalTimeoutMs,
        rebalanceThreshold: config.indexConfig.rebalanceThreshold,
        riskThreshold: config.indexConfig.riskThreshold
      }
    );
    
    // Enable event logging if configured
    if (config.logEvents) {
      this.eventBus.enableLogging();
    }
    
    this.setupEventHandlers();
  }
  
  /**
   * Setup event handlers for coordinating between services
   */
  private setupEventHandlers(): void {
    // System events
    this.eventBus.onEvent(EventType.SYSTEM_ERROR, (error) => {
      console.error('❌ System error:', error);
    });
    
    // Handle HCS10 events
    this.eventBus.onEvent(EventType.HCS10_REQUEST_RECEIVED, (data) => {
      console.log(`📩 Received request from ${data.senderId}: ${data.requestId}`);
      this.processHCS10Request(data.requestId, data.senderId, data.request);
    });
    
    // Handle Index events
    this.eventBus.onEvent(EventType.INDEX_REBALANCE_PROPOSED, (data) => {
      console.log(`📊 Rebalance proposed: ${data.proposalId}`);
      // This would typically trigger a vote or process in the HCS10ProtocolService
      this.notifyRebalanceProposal(data);
    });
    
    this.eventBus.onEvent(EventType.INDEX_REBALANCE_APPROVED, (data) => {
      console.log(`✅ Rebalance approved: ${data.proposalId}`);
      // Notify other agents about the approval
      this.notifyRebalanceApproval(data);
    });
    
    this.eventBus.onEvent(EventType.INDEX_REBALANCE_EXECUTED, (data) => {
      console.log(`🔄 Rebalance executed: ${data.proposalId}`);
      // Notify other agents about the execution
      this.notifyRebalanceExecution(data);
    });
    
    this.eventBus.onEvent(EventType.INDEX_RISK_ALERT, (data) => {
      console.log(`⚠️ Risk alert: ${data.severity} - ${data.riskDescription}`);
      // Notify other agents about the risk
      this.notifyRiskAlert(data);
    });
  }
  
  /**
   * Notify HCS10 protocol agents about a rebalance proposal
   */
  private async notifyRebalanceProposal(data: { proposalId: string, newWeights: Record<string, number>, trigger: string }): Promise<void> {
    // Find agents with rebalancing capability
    const rebalancingAgents = this.hcs10Service.findAgentsByCapability('rebalancing');
    
    // Notify each rebalancing agent
    for (const agentId of rebalancingAgents) {
      try {
        await this.hcs10Service.sendRequest(agentId, {
          action: 'rebalance-proposal',
          proposalId: data.proposalId,
          newWeights: data.newWeights,
          trigger: data.trigger
        });
      } catch (error) {
        console.error(`❌ Failed to notify agent ${agentId} about rebalance proposal:`, error);
      }
    }
  }
  
  /**
   * Notify HCS10 protocol agents about a rebalance approval
   */
  private async notifyRebalanceApproval(data: { proposalId: string, approvedAt: number }): Promise<void> {
    // Find agents with rebalancing capability
    const rebalancingAgents = this.hcs10Service.findAgentsByCapability('rebalancing');
    
    // Notify each rebalancing agent
    for (const agentId of rebalancingAgents) {
      try {
        await this.hcs10Service.sendRequest(agentId, {
          action: 'rebalance-approved',
          proposalId: data.proposalId,
          approvedAt: data.approvedAt
        });
      } catch (error) {
        console.error(`❌ Failed to notify agent ${agentId} about rebalance approval:`, error);
      }
    }
  }
  
  /**
   * Notify HCS10 protocol agents about a rebalance execution
   */
  private async notifyRebalanceExecution(data: { proposalId: string, preBalances: Record<string, number>, postBalances: Record<string, number>, executedAt: number }): Promise<void> {
    // Find agents with rebalancing capability
    const rebalancingAgents = this.hcs10Service.findAgentsByCapability('rebalancing');
    
    // Notify each rebalancing agent
    for (const agentId of rebalancingAgents) {
      try {
        await this.hcs10Service.sendRequest(agentId, {
          action: 'rebalance-executed',
          proposalId: data.proposalId,
          preBalances: data.preBalances,
          postBalances: data.postBalances,
          executedAt: data.executedAt
        });
      } catch (error) {
        console.error(`❌ Failed to notify agent ${agentId} about rebalance execution:`, error);
      }
    }
  }
  
  /**
   * Notify HCS10 protocol agents about a risk alert
   */
  private async notifyRiskAlert(data: { severity: string, riskDescription: string, affectedTokens?: string[] }): Promise<void> {
    // Find agents with rebalancing and risk assessment capabilities
    const riskAgents = [
      ...this.hcs10Service.findAgentsByCapability('risk-assessment'),
      ...this.hcs10Service.findAgentsByCapability('rebalancing')
    ];
    
    // Remove duplicates - convert to Array for better compatibility
    const uniqueAgents = Array.from(new Set(riskAgents));
    
    // Notify each relevant agent
    for (const agentId of uniqueAgents) {
      try {
        await this.hcs10Service.sendRequest(agentId, {
          action: 'risk-alert',
          severity: data.severity,
          description: data.riskDescription,
          affectedTokens: data.affectedTokens
        });
      } catch (error) {
        console.error(`❌ Failed to notify agent ${agentId} about risk alert:`, error);
      }
    }
  }

  /**
   * Process an incoming HCS10 request
   */
  private async processHCS10Request(requestId: string, senderId: string, request: any): Promise<void> {
    try {
      console.log(`🔄 Processing request: ${request.action || 'unknown'}`);
      
      let response;
      
      // Route based on action type
      switch (request.action) {
        case 'rebalance-proposal':
          // Handle rebalance proposal from another agent
          response = await this.handleRebalanceProposalRequest(request);
          break;
        
        case 'get-token-prices':
          // Return current token prices
          response = {
            status: 'success',
            prices: this.indexService.getTokenPrices()
          };
          break;
          
        case 'get-current-weights':
          // Return current token weights
          response = {
            status: 'success',
            weights: this.indexService.getCurrentWeights()
          };
          break;
          
        default:
          response = {
            status: 'error',
            message: `Unknown action: ${request.action}`
          };
      }
      
      // Send response through HCS10 protocol service
      await this.hcs10Service.sendResponse(senderId, requestId, response);
      
      this.eventBus.emitEvent(EventType.HCS10_RESPONSE_SENT, {
        requestId,
        recipientId: senderId,
        response
      });
    } catch (error) {
      console.error('❌ Error processing HCS10 request:', error);
      
      const errorResponse = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Try to send error response
      try {
        await this.hcs10Service.sendResponse(senderId, requestId, errorResponse);
      } catch (sendError) {
        console.error('❌ Failed to send error response:', sendError);
      }
      
      this.eventBus.emitEvent(EventType.HCS10_RESPONSE_SENT, {
        requestId,
        recipientId: senderId,
        response: errorResponse
      });
    }
  }
  
  /**
   * Handle a rebalance proposal request from another agent
   */
  private async handleRebalanceProposalRequest(request: any): Promise<any> {
    // In a full implementation, this would analyze the proposal and vote/approve
    // For this simplified version, we'll just acknowledge receipt
    
    return {
      status: 'success',
      message: 'Rebalance proposal received',
      proposalId: request.proposalId,
      acknowledged: true
    };
  }

  /**
   * Initialize the agent and all required services
   */
  public async initialize(): Promise<void> {
    if (this.initialized || this.isInitializing) {
      return;
    }
    
    this.isInitializing = true;
    
    try {
      console.log('🔄 Initializing LynxifyAgent...');
      
      // Initialize the Hedera service
      await this.hederaService.initialize();
      
      // Initialize HCS10 protocol service
      console.log('🔄 Setting up HCS10 protocol...');
      await this.hcs10Service.initialize();
      
      // Initialize Tokenized Index service
      console.log('🔄 Setting up tokenized index service...');
      await this.indexService.initialize();
      
      // Subscribe to required topics
      await this.subscribeToRequiredTopics();
      
      // Setup shutdown handlers
      this.setupShutdownHandlers();
      
      this.initialized = true;
      this.isInitializing = false;
      
      console.log('✅ LynxifyAgent initialized successfully');
      this.eventBus.emitEvent(EventType.SYSTEM_INITIALIZED, {
        agentId: this.config.agentId,
        timestamp: Date.now(),
        status: 'initialized'
      });
    } catch (error) {
      this.isInitializing = false;
      console.error('❌ Failed to initialize LynxifyAgent:', error);
      
      if (error instanceof Error) {
        this.eventBus.emitEvent(EventType.SYSTEM_ERROR, error);
      } else {
        this.eventBus.emitEvent(EventType.SYSTEM_ERROR, new Error('Unknown initialization error'));
      }
      
      throw error;
    }
  }
  
  /**
   * Subscribe to required topics for both HCS10 and Tokenized Index functionality
   */
  private async subscribeToRequiredTopics(): Promise<void> {
    try {
      console.log('🔄 Subscribing to required topics...');
      
      // Subscribe to HCS10 registry topic
      await this.hederaService.subscribeToTopic(
        this.config.hcs10Config.registryTopicId,
        (message) => this.handleHCS10RegistryMessage(message)
      );
      
      // Subscribe to index topic
      await this.hederaService.subscribeToTopic(
        this.config.indexConfig.indexTopicId,
        (message) => this.handleIndexMessage(message)
      );
      
      // Subscribe to agent's inbound topic if provided
      if (this.config.hcs10Config.agentTopicId) {
        await this.hederaService.subscribeToTopic(
          this.config.hcs10Config.agentTopicId,
          (message) => this.handleAgentMessage(message)
        );
      }
      
      console.log('✅ Successfully subscribed to all required topics');
    } catch (error) {
      console.error('❌ Failed to subscribe to required topics:', error);
      throw error;
    }
  }
  
  /**
   * Handle messages from the HCS10 registry topic
   */
  private handleHCS10RegistryMessage(message: any): void {
    try {
      console.log(`📩 Registry message received [${message.sequenceNumber}]`);
      
      // Process registry message
      // In a full implementation, this would be delegated to the HCS10ProtocolService
      
      // Emit message received event
      this.eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
        topicId: message.topicId,
        sequenceNumber: message.sequenceNumber,
        contents: message.contents,
        consensusTimestamp: message.consensusTimestamp
      });
    } catch (error) {
      console.error('❌ Error processing registry message:', error);
      
      if (error instanceof Error) {
        this.eventBus.emitEvent(EventType.MESSAGE_ERROR, {
          topicId: message.topicId,
          error: error,
          contents: message.contents
        });
      }
    }
  }
  
  /**
   * Handle messages from the index topic
   */
  private handleIndexMessage(message: any): void {
    try {
      console.log(`📩 Index message received [${message.sequenceNumber}]`);
      
      // Process index message
      // In a full implementation, this would be delegated to the TokenizedIndexService
      
      // Emit message received event
      this.eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
        topicId: message.topicId,
        sequenceNumber: message.sequenceNumber,
        contents: message.contents,
        consensusTimestamp: message.consensusTimestamp
      });
    } catch (error) {
      console.error('❌ Error processing index message:', error);
      
      if (error instanceof Error) {
        this.eventBus.emitEvent(EventType.MESSAGE_ERROR, {
          topicId: message.topicId,
          error: error,
          contents: message.contents
        });
      }
    }
  }
  
  /**
   * Handle messages from the agent's inbound topic
   */
  private handleAgentMessage(message: any): void {
    try {
      console.log(`📩 Agent message received [${message.sequenceNumber}]`);
      
      // Process agent-specific message
      // This would be a combination of HCS10 protocol and business logic
      
      // Emit message received event
      this.eventBus.emitEvent(EventType.MESSAGE_RECEIVED, {
        topicId: message.topicId,
        sequenceNumber: message.sequenceNumber,
        contents: message.contents,
        consensusTimestamp: message.consensusTimestamp
      });
    } catch (error) {
      console.error('❌ Error processing agent message:', error);
      
      if (error instanceof Error) {
        this.eventBus.emitEvent(EventType.MESSAGE_ERROR, {
          topicId: message.topicId,
          error: error,
          contents: message.contents
        });
      }
    }
  }
  
  /**
   * Setup handlers for graceful shutdown
   */
  private setupShutdownHandlers(): void {
    // Handle process termination signals
    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }
  
  /**
   * Gracefully shutdown the agent and all services
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized || this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    try {
      console.log('🛑 Shutting down LynxifyAgent...');
      
      // Gracefully shutdown in reverse order of initialization
      // First the business logic services
      if (this.indexService && typeof this.indexService.shutdown === 'function') {
        await this.indexService.shutdown();
      }
      
      // Then the protocol services
      if (this.hcs10Service && typeof this.hcs10Service.shutdown === 'function') {
        await this.hcs10Service.shutdown();
      }
      
      // Finally the core Hedera service
      await this.hederaService.shutdown();
      
      this.initialized = false;
      this.isShuttingDown = false;
      
      console.log('✅ LynxifyAgent shutdown completed');
      this.eventBus.emitEvent(EventType.SYSTEM_SHUTDOWN, undefined);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      this.isShuttingDown = false;
      
      // Emit error event
      if (error instanceof Error) {
        this.eventBus.emitEvent(EventType.SYSTEM_ERROR, error);
      } else {
        this.eventBus.emitEvent(EventType.SYSTEM_ERROR, new Error('Unknown shutdown error'));
      }
    }
  }
  
  /**
   * Get the agent's configuration
   */
  public getConfig(): LynxifyAgentConfig {
    return { ...this.config };
  }
  
  /**
   * Get the Hedera service instance
   */
  public getHederaService(): SharedHederaService {
    return this.hederaService;
  }
  
  /**
   * Check if the agent is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get the HCS10 Protocol Service
   */
  public getHCS10Service(): HCS10ProtocolService {
    return this.hcs10Service;
  }
  
  /**
   * Get the Tokenized Index Service
   */
  public getIndexService(): TokenizedIndexService {
    return this.indexService;
  }
} 