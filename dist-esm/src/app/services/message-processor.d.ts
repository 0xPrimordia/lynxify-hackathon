import { HCS10Client } from '@hashgraphonline/standards-sdk';
/**
 * Message Processor Service
 * Handles messages received on connection topics according to the HCS-10 protocol
 */
export declare class MessageProcessorService {
    private client;
    private connections;
    private logger;
    private isProcessing;
    private messageHandlers;
    constructor(client: HCS10Client);
    /**
     * Initialize the service by loading existing connections
     */
    initialize(): Promise<boolean>;
    /**
     * Load existing connections
     */
    private loadConnections;
    /**
     * Register a message handler for a specific message type
     * @param messageType The type of message to handle
     * @param handler The handler function
     */
    registerHandler(messageType: string, handler: (message: any, senderId: string) => Promise<void>): void;
    /**
     * Start processing messages on all connection topics
     */
    startProcessing(): Promise<boolean>;
    /**
     * Monitor a specific connection topic for messages
     * @param requesterId The requester's account ID
     * @param topicId The connection topic ID
     */
    private monitorConnectionTopic;
    /**
     * Helper method to safely extract message content from an HCS message
     * Handles both 'content' and 'contents' property names that may be present at runtime
     */
    private getMessageContent;
    /**
     * Process a received message
     * @param message The HCS message
     * @param senderId The sender's account ID
     */
    private processMessage;
    /**
     * Process a standard message
     * @param message The standard message
     * @param senderId The sender's account ID
     */
    private processStandardMessage;
    /**
     * Process an HCS-1 reference to a large message
     * @param reference The HCS-1 reference
     * @param senderId The sender's account ID
     */
    private processHCS1Reference;
    /**
     * Process a close connection message
     * @param message The close connection message
     * @param senderId The sender's account ID
     */
    private processCloseConnection;
    /**
     * Send a message to a specific connection
     * @param requesterId The requester's account ID
     * @param message The message to send
     */
    sendMessage(requesterId: string, message: any): Promise<boolean>;
    /**
     * Send a large message using HCS-1
     * @param requesterId The requester's account ID
     * @param message The message to send
     */
    sendLargeMessage(requesterId: string, message: any): Promise<boolean>;
    /**
     * Create a storage topic for large messages
     * @private
     */
    private createStorageTopic;
}
export declare function createMessageProcessor(client: HCS10Client): MessageProcessorService;
