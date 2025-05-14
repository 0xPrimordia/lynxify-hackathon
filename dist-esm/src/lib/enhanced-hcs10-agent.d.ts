import { MessageStreamResponse, HCSMessage } from './types/hcs10-types';
export interface HCS10Client {
    createTopic(): Promise<string>;
    sendMessage(topicId: string, message: string): Promise<{
        success: boolean;
    }>;
    getMessageStream(topicId: string): Promise<MessageStreamResponse>;
    retrieveCommunicationTopics?(accountId: string): Promise<{
        inboundTopic: string;
        outboundTopic: string;
    }>;
    getMessages?(topicId: string): Promise<HCSMessage[]>;
}
/**
 * EnhancedHCS10Agent class
 * Handles connections and proposal processing for the Lynxify tokenized index
 * This version includes direct ConnectionsManager integration
 */
export declare class EnhancedHCS10Agent {
    private client;
    private inboundTopicId;
    private outboundTopicId;
    private connections;
    private pendingProposals;
    private executedProposals;
    private pollingInterval;
    private lastSequence;
    private profileTopicId;
    private connectionsManager;
    private agentId;
    constructor(client: HCS10Client, inboundTopicId: string, outboundTopicId: string, agentId?: string, profileTopicId?: string);
    /**
     * Initialize ConnectionsManager using the wrapper to handle ESM compatibility
     */
    private initConnectionsManager;
    /**
     * Load connections from ConnectionsManager
     */
    private loadConnectionsFromManager;
    /**
     * Start the agent's polling for new messages
     * @param pollingIntervalMs The interval in milliseconds to poll for new messages
     */
    start(pollingIntervalMs?: number): void;
    /**
     * Stop the agent's polling
     */
    stop(): void;
    /**
     * Poll for new messages on the inbound topic
     */
    private pollForMessages;
    /**
     * Process pending connection requests using ConnectionsManager
     */
    private processPendingRequests;
    /**
     * Process a received message
     * @param messageContent The content of the message
     * @param topicId The topic ID the message was received on
     */
    private processMessage;
    /**
     * Handle a connection request
     * @param message The connection request message
     */
    private handleConnectionRequest;
    /**
     * Handle an application message
     * @param message The HCS-10 message wrapper
     */
    private handleApplicationMessage;
    /**
     * Load existing connections from file
     * @returns Array of connections
     */
    private loadConnections;
    /**
     * Save connections to file
     */
    private saveConnections;
    /**
     * Load pending proposals from file
     * @returns Array of pending proposals
     */
    private loadPendingProposals;
    /**
     * Save pending proposals to file
     */
    private savePendingProposals;
    /**
     * Load executed proposals from file
     * @returns Array of executed proposals
     */
    private loadExecutedProposals;
    /**
     * Save executed proposals to file
     */
    private saveExecutedProposals;
    /**
     * Update agent profile
     */
    private updateProfile;
    /**
     * Handle a rebalance proposal
     * @param proposal The rebalance proposal
     */
    private handleRebalanceProposal;
    /**
     * Handle a rebalance approval
     * @param approval The rebalance approval
     */
    private handleRebalanceApproved;
}
