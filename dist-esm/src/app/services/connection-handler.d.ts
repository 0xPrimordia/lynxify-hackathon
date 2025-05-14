import { HCS10Client } from '@hashgraphonline/standards-sdk';
/**
 * Connection Handler Service
 * Handles HCS-10 connection requests and manages active connections
 */
export declare class ConnectionHandlerService {
    private client;
    private inboundTopicId;
    private connections;
    private logger;
    private isListening;
    constructor(client: HCS10Client);
    /**
     * Initialize the service by loading existing connections and registration info
     */
    initialize(): Promise<boolean>;
    /**
     * Load agent registration information
     */
    private loadRegistrationInfo;
    /**
     * Load existing connections
     */
    private loadConnections;
    /**
     * Start listening for connection requests on the inbound topic
     */
    startListening(): Promise<boolean>;
    /**
     * Helper method to safely extract message content from an HCS message
     * Handles both 'content' and 'contents' property names that may be present at runtime
     */
    private getMessageContent;
    /**
     * Handle a connection request
     * @param message The connection request message
     * @param sequenceNumber The sequence number of the message
     */
    private handleConnectionRequest;
    /**
     * Save the current connections to a file
     */
    private saveConnections;
    /**
     * Get all active connections
     */
    getConnections(): Map<string, string>;
    /**
     * Get connection topic ID for a specific requester
     * @param requesterId The requester's account ID
     */
    getConnectionTopicId(requesterId: string): string | undefined;
}
export declare function createConnectionHandler(client: HCS10Client): ConnectionHandlerService;
