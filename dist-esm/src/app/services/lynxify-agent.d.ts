import { SharedHederaService } from './shared-hedera-service';
import { HCS10ProtocolService } from './hcs10-protocol';
import { TokenizedIndexService } from './tokenized-index';
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
export declare class LynxifyAgent {
    private readonly eventBus;
    private readonly hederaService;
    private readonly config;
    private readonly hcs10Service;
    private readonly indexService;
    private initialized;
    private isInitializing;
    private isShuttingDown;
    /**
     * Create a new LynxifyAgent instance
     * @param config Agent configuration options
     */
    constructor(config: LynxifyAgentConfig);
    /**
     * Setup event handlers for coordinating between services
     */
    private setupEventHandlers;
    /**
     * Notify HCS10 protocol agents about a rebalance proposal
     */
    private notifyRebalanceProposal;
    /**
     * Notify HCS10 protocol agents about a rebalance approval
     */
    private notifyRebalanceApproval;
    /**
     * Notify HCS10 protocol agents about a rebalance execution
     */
    private notifyRebalanceExecution;
    /**
     * Notify HCS10 protocol agents about a risk alert
     */
    private notifyRiskAlert;
    /**
     * Process an incoming HCS10 request
     */
    private processHCS10Request;
    /**
     * Handle a rebalance proposal request from another agent
     */
    private handleRebalanceProposalRequest;
    /**
     * Initialize the agent and all required services
     */
    initialize(): Promise<void>;
    /**
     * Subscribe to required topics for both HCS10 and Tokenized Index functionality
     */
    private subscribeToRequiredTopics;
    /**
     * Handle messages from the HCS10 registry topic
     */
    private handleHCS10RegistryMessage;
    /**
     * Handle messages from the index topic
     */
    private handleIndexMessage;
    /**
     * Handle messages from the agent's inbound topic
     */
    private handleAgentMessage;
    /**
     * Setup handlers for graceful shutdown
     */
    private setupShutdownHandlers;
    /**
     * Gracefully shutdown the agent and all services
     */
    shutdown(): Promise<void>;
    /**
     * Get the agent's configuration
     */
    getConfig(): LynxifyAgentConfig;
    /**
     * Get the Hedera service instance
     */
    getHederaService(): SharedHederaService;
    /**
     * Check if the agent is initialized
     */
    isInitialized(): boolean;
    /**
     * Get the HCS10 Protocol Service
     */
    getHCS10Service(): HCS10ProtocolService;
    /**
     * Get the Tokenized Index Service
     */
    getIndexService(): TokenizedIndexService;
}
