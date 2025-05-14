import { HCS10Client } from '@hashgraphonline/standards-sdk';
import { TokenService } from './token-service.js';
interface RegistrationInfo {
    accountId: string;
    inboundTopicId: string;
    outboundTopicId: string;
    registryTopic: string;
    timestamp: number;
}
/**
 * HCS-10 Agent Service
 * Coordinates all components of the HCS-10 agent implementation
 */
export declare class AgentServiceHCS10 {
    private client;
    private logger;
    private connectionHandler;
    private messageProcessor;
    private proposalHandler;
    private tokenService;
    private baseTokenService;
    private registrationInfo;
    private isRunning;
    constructor(client: HCS10Client, baseTokenService: TokenService);
    /**
     * Initialize the agent service and all its components
     */
    initialize(): Promise<boolean>;
    /**
     * Load agent registration information
     */
    private loadRegistrationInfo;
    /**
     * Register message handlers for different message types
     */
    private registerMessageHandlers;
    /**
     * Start the agent service
     */
    start(): Promise<boolean>;
    /**
     * Handle a query for index composition
     * @param message The query message
     * @param senderId The sender's account ID
     */
    private handleIndexCompositionQuery;
    /**
     * Get the agent's registration info
     */
    getRegistrationInfo(): RegistrationInfo | null;
    /**
     * Get active connections
     */
    getActiveConnections(): Map<string, string>;
    /**
     * Get pending proposals
     */
    getPendingProposals(): any[];
    /**
     * Get executed proposals
     */
    getExecutedProposals(): any[];
    /**
     * Check if the agent service is running
     */
    isActive(): boolean;
}
/**
 * Create and initialize an HCS-10 agent service
 */
export declare function createAgentService(client: HCS10Client, tokenService: TokenService): Promise<AgentServiceHCS10>;
export {};
