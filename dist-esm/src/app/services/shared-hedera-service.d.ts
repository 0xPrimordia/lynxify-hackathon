import { Client, TopicMessage } from "@hashgraph/sdk";
import { EventEmitter } from 'events';
/**
 * Configuration for the SharedHederaService
 */
export interface SharedHederaConfig {
    network: 'testnet' | 'mainnet' | 'custom';
    operatorId?: string;
    operatorKey?: string;
    customNetwork?: Record<string, string>;
    maxQueryPayment?: number;
}
/**
 * HCS Topic Message interface
 */
export interface HCSTopicMessage<T = any> {
    id: string;
    topicId: string;
    contents: T;
    sequenceNumber: number;
    consensusTimestamp: Date;
    raw?: TopicMessage;
}
/**
 * SharedHederaService
 *
 * A consolidated service that handles all Hedera interactions for both
 * business logic operations and HCS-10 protocol communications.
 */
export declare class SharedHederaService extends EventEmitter {
    private client;
    private subscriptions;
    private topicCallbacks;
    private initialized;
    private isInitializing;
    private isShuttingDown;
    topics: {
        GOVERNANCE: string;
        PRICE_FEED: string;
        AGENT_ACTIONS: string;
        REGISTRY: string;
        AGENT: string;
        INBOUND: string;
        OUTBOUND: string;
        PROFILE: string;
    };
    /**
     * Constructor
     * @param config Configuration for the Hedera service
     */
    constructor(config?: SharedHederaConfig);
    /**
     * Initialize the Hedera client
     * @param config Optional configuration
     * @returns Initialized Hedera client
     */
    private initializeClient;
    /**
     * Get the Hedera client instance
     * @returns The Hedera client
     */
    getClient(): Client;
    /**
     * Initialize the service and verify topic configurations
     */
    initialize(): Promise<void>;
    /**
     * Setup handlers for graceful shutdown
     */
    private setupShutdownHandlers;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Verify topic configurations and create missing topics
     */
    verifyTopics(): Promise<void>;
    /**
     * Create a new HCS topic
     * @param memo Optional memo for the topic
     * @returns The newly created topic ID as a string
     */
    createTopic(memo?: string): Promise<string>;
    /**
     * Send a message to a specific topic
     * @param topicId The topic ID to send the message to
     * @param message The message to send (will be stringified if object)
     * @returns Transaction details
     */
    sendMessage(topicId: string, message: string | object): Promise<{
        transactionId: string;
        success: boolean;
    }>;
    /**
     * Subscribe to a topic for messages
     * @param topicId The topic ID to subscribe to
     * @param callback Callback function to handle incoming messages
     */
    subscribeToTopic(topicId: string, callback: (message: HCSTopicMessage) => void): Promise<void>;
    /**
     * Unsubscribe from a topic
     * @param topicId The topic ID to unsubscribe from
     */
    unsubscribeFromTopic(topicId: string): Promise<void>;
    /**
     * Remove a specific callback from a topic subscription
     * @param topicId The topic ID
     * @param callback The callback function to remove
     */
    removeCallback(topicId: string, callback: (message: HCSTopicMessage) => void): void;
    /**
     * Format a topic ID string to ensure it's properly formatted
     * @param topicId The topic ID to format
     * @returns Properly formatted topic ID
     */
    formatTopicId(topicId: string): string;
    /**
     * Get the status of all topics
     * @returns Object containing topic status information
     */
    getTopicStatus(): Record<string, string | boolean | string[]>;
}
export declare const sharedHederaService: SharedHederaService;
