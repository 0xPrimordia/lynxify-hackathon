import { HCS10Client } from '../hcs10-agent.js';
import { HCSMessage } from '../types/hcs10-types.js';
import { EventEmitter } from 'events';
interface Connection {
    connectionTopicId: string;
    targetAccountId: string;
    targetAgentName?: string;
    targetInboundTopicId?: string;
    targetOutboundTopicId?: string;
    status: 'pending' | 'established' | 'needs_confirmation' | 'closed';
    isPending: boolean;
    needsConfirmation: boolean;
    memo?: string;
    created: Date;
    lastActivity?: Date;
    connectionRequestId?: number;
    uniqueRequestKey?: string;
    from?: string;
    id?: string;
}
interface ConnectionsManagerInterface {
    setAgentInfo(info: {
        accountId: string;
        inboundTopicId: string;
        outboundTopicId: string;
    }): Promise<void>;
    fetchConnectionData(accountId: string): Promise<Connection[]>;
    processInboundMessages(messages: HCSMessage[]): Promise<void>;
    getPendingRequests(): Connection[];
    acceptConnectionRequest(options: {
        requestId: string;
        memo?: string;
    }): Promise<void>;
}
/**
 * HCS10AgentWithConnections
 * Enhanced HCS10Agent implementation that properly uses the ConnectionsManager from standards-sdk
 */
export declare class HCS10AgentWithConnections extends EventEmitter {
    private client;
    private inboundTopicId;
    private outboundTopicId;
    private agentId;
    private connectionsManager;
    private pollingInterval;
    private lastSequence;
    private isConnectionsManagerInitialized;
    private initAttempted;
    /**
     * Create a new HCS10 agent with ConnectionsManager
     * @param client An HCS10Client instance
     * @param inboundTopicId The agent's inbound topic ID
     * @param outboundTopicId The agent's outbound topic ID
     * @param agentId The agent's ID (usually an account ID)
     */
    constructor(client: HCS10Client, inboundTopicId: string, outboundTopicId: string, agentId?: string);
    /**
     * Initialize the ConnectionsManager using proper ES Module import
     */
    private initializeConnectionsManager;
    /**
     * Start polling for messages
     * @param pollingIntervalMs Polling interval in milliseconds
     */
    start(pollingIntervalMs?: number): void;
    /**
     * Stop polling for messages
     */
    stop(): void;
    /**
     * Poll for new messages
     */
    private pollForMessages;
    /**
     * Process messages directly without ConnectionsManager
     */
    private processSingleMessages;
    /**
     * Process pending connection requests
     */
    private processPendingRequests;
    /**
     * Get the ConnectionsManager instance
     */
    getConnectionsManager(): ConnectionsManagerInterface | null;
    /**
     * Check if the agent is ready (ConnectionsManager initialized)
     */
    isReady(): boolean;
    /**
     * Wait until the agent is ready
     * @param timeoutMs Timeout in milliseconds
     */
    waitUntilReady(timeoutMs?: number): Promise<boolean>;
}
export {};
