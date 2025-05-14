import { SharedHederaService } from './shared-hedera-service.js';
/**
 * Configuration for the HCS10 Protocol Service
 */
export interface HCS10ProtocolConfig {
    agentId: string;
    registryTopicId: string;
    agentTopicId?: string;
    capabilities?: string[];
    description?: string;
    reregistrationIntervalMs?: number;
    discoveryIntervalMs?: number;
}
export declare enum RegistrationStatus {
    UNKNOWN = "unknown",
    PENDING = "pending",
    REGISTERED = "registered",
    VERIFIED = "verified",
    FAILED = "failed"
}
export interface AgentInfo {
    agentId: string;
    topicId: string;
    capabilities: string[];
    lastSeen: number;
    description?: string;
    status: RegistrationStatus;
    registrationTimestamp?: number;
    verificationTimestamp?: number;
}
/**
 * Message structure for HCS-10 protocol
 */
export interface HCS10Message {
    id: string;
    timestamp: number;
    type: 'AgentInfo' | 'AgentRequest' | 'AgentResponse' | 'AgentVerification' | 'AgentDiscovery';
    sender: string;
    recipient?: string;
    originalMessageId?: string;
    contents: any;
}
export interface PendingRequest {
    id: string;
    recipientId: string;
    timestamp: number;
    contents: any;
    status: 'pending' | 'delivered' | 'responded' | 'timeout' | 'error';
    response?: any;
    responseTimestamp?: number;
    error?: Error;
    retryCount: number;
    maxRetries: number;
    timeoutMs: number;
    timeoutId?: NodeJS.Timeout;
}
/**
 * Service that handles all aspects of the HCS-10 protocol
 */
export declare class HCS10ProtocolService {
    private readonly eventBus;
    private readonly hederaService;
    private readonly config;
    private agentTopicId;
    private knownAgents;
    private pendingRequests;
    private responseListeners;
    private initialized;
    private registrationStatus;
    private registrationTimestamp;
    private verificationTimestamp;
    private reregistrationInterval;
    private discoveryInterval;
    private lastRegistryUpdate;
    /**
     * Create a new HCS10ProtocolService
     */
    constructor(hederaService: SharedHederaService, config: HCS10ProtocolConfig, testingMode?: boolean);
    /**
     * Set up event handlers for the service
     */
    private setupEventHandlers;
    /**
     * Process messages from the registry topic
     */
    private processRegistryMessage;
    /**
     * Handle AgentInfo messages
     */
    private handleAgentInfoMessage;
    /**
     * Handle AgentVerification messages
     */
    private handleAgentVerificationMessage;
    /**
     * Handle AgentDiscovery messages
     */
    private handleAgentDiscoveryMessage;
    /**
     * Send a verification message to another agent
     */
    private sendVerification;
    /**
     * Process messages sent to this agent's topic
     */
    private processAgentMessage;
    /**
     * Update the agent registry with new information
     */
    private updateAgentRegistry;
    /**
     * Validate that a message follows the HCS10 protocol format
     */
    private isValidHCS10Message;
    /**
     * Initialize the HCS10 Protocol Service
     */
    initialize(): Promise<void>;
    /**
     * Create a dedicated topic for this agent
     */
    private createAgentTopic;
    /**
     * Register this agent with the HCS10 registry
     */
    private registerAgent;
    /**
     * Send agent info to registry topic
     */
    private sendAgentInfo;
    /**
     * Verify agent registration
     */
    private verifyAgentRegistration;
    /**
     * Send discovery request to find other agents
     */
    private discoverAgents;
    /**
     * Schedule periodic registry updates
     */
    private scheduleRegistryUpdates;
    /**
     * Schedule periodic agent discovery
     */
    private scheduleAgentDiscovery;
    /**
     * Schedule periodic cleanup of pending requests
     */
    private schedulePendingRequestCleanup;
    /**
     * Clean up old pending requests
     */
    private cleanupPendingRequests;
    /**
     * Get a pending request by ID
     */
    getPendingRequest(requestId: string): PendingRequest | undefined;
    /**
     * Get all pending requests
     */
    getAllPendingRequests(): Map<string, PendingRequest>;
    /**
     * Cancel a pending request
     */
    cancelRequest(requestId: string): boolean;
    /**
     * Clear all intervals and timeouts
     */
    private clearIntervals;
    /**
     * Send a request to another agent with options for timeout and retry
     */
    sendRequest(recipientId: string, contents: any, options?: {
        timeoutMs?: number;
        maxRetries?: number;
        waitForResponse?: boolean;
    }): Promise<{
        requestId: string;
        response?: any;
    }>;
    /**
     * Wait for a response to a specific request
     */
    private waitForResponse;
    /**
     * Add a listener for a response to a specific request
     */
    private addResponseListener;
    /**
     * Remove all listeners for a specific request
     */
    private removeResponseListeners;
    /**
     * Notify all listeners for a specific request
     */
    private notifyResponseListeners;
    /**
     * Handle a request timeout
     */
    private handleRequestTimeout;
    /**
     * Retry a request
     */
    private retryRequest;
    /**
     * Get the list of all known agents
     */
    getKnownAgents(): Map<string, AgentInfo>;
    /**
     * Find agents with a specific capability
     */
    findAgentsByCapability(capability: string): string[];
    /**
     * Get this agent's topic ID
     */
    getAgentTopicId(): string | null;
    /**
     * Get this agent's registration status
     */
    getRegistrationStatus(): RegistrationStatus;
    /**
     * Get this agent's registration timestamp
     */
    getRegistrationTimestamp(): number | null;
    /**
     * Get this agent's verification timestamp
     */
    getVerificationTimestamp(): number | null;
    /**
     * Check if agent is registered
     */
    isAgentRegistered(): boolean;
    /**
     * Check if agent is verified
     */
    isAgentVerified(): boolean;
    /**
     * Send a response to an agent for a specific request
     *
     * @param recipientId The agent ID to send the response to
     * @param requestId The original request ID this response is for
     * @param response The response payload
     * @returns Promise resolving to the response information
     */
    sendResponse(recipientId: string, requestId: string, response: any): Promise<{
        requestId: string;
        recipientId: string;
    }>;
    /**
     * Shutdown the service and clean up resources
     */
    shutdown(): Promise<void>;
    /**
     * Disable all periodic timers (useful for testing)
     * @internal This method is intended for testing purposes only
     */
    disablePeriodicTimers(): void;
}
