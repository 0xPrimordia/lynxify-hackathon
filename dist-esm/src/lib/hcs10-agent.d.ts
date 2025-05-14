import { MessageStreamResponse } from './types/hcs10-types.js';
export interface HCS10Client {
    createTopic(): Promise<string>;
    sendMessage(topicId: string, message: string): Promise<{
        success: boolean;
    }>;
    getMessageStream(topicId: string): Promise<MessageStreamResponse>;
    retrieveCommunicationTopics?: (accountId: string) => Promise<any>;
    getMessages?: (topicId: string) => Promise<any>;
}
/**
 * HCS10Agent class
 * Handles connections and proposal processing for the Lynxify tokenized index
 */
export declare class HCS10Agent {
    private client;
    private inboundTopicId;
    private outboundTopicId;
    private connections;
    private pendingProposals;
    private executedProposals;
    private pollingInterval;
    private lastSequence;
    private profileTopicId;
    constructor(client: HCS10Client, inboundTopicId: string, outboundTopicId: string, profileTopicId?: string);
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
     * Handle a rebalance proposal
     * @param proposal The rebalance proposal
     */
    private handleRebalanceProposal;
    /**
     * Handle a rebalance approval
     * @param approval The rebalance approval
     */
    private handleRebalanceApproved;
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
}
