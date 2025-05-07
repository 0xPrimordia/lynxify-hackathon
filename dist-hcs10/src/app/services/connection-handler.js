import { Logger } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const REGISTRATION_STATUS_FILE = path.join(process.cwd(), '.registration_status.json');
/**
 * Connection Handler Service
 * Handles HCS-10 connection requests and manages active connections
 */
export class ConnectionHandlerService {
    constructor(client) {
        this.inboundTopicId = null;
        this.connections = new Map(); // requesterId -> connectionTopicId
        this.isListening = false;
        this.client = client;
        this.logger = new Logger({
            module: 'ConnectionHandler',
            level: 'debug',
            prettyPrint: true,
        });
    }
    /**
     * Initialize the service by loading existing connections and registration info
     */
    async initialize() {
        try {
            // Load registration info first
            await this.loadRegistrationInfo();
            if (!this.inboundTopicId) {
                this.logger.error('Agent not properly registered, inbound topic ID is missing');
                return false;
            }
            // Load existing connections
            await this.loadConnections();
            this.logger.info(`Initialized with inbound topic ${this.inboundTopicId} and ${this.connections.size} connections`);
            return true;
        }
        catch (error) {
            this.logger.error('Failed to initialize connection handler:', error);
            return false;
        }
    }
    /**
     * Load agent registration information
     */
    async loadRegistrationInfo() {
        try {
            const data = await fs.readFile(REGISTRATION_STATUS_FILE, 'utf8');
            const info = JSON.parse(data);
            if (!info.inboundTopicId) {
                throw new Error('Inbound topic ID not found in registration info');
            }
            this.inboundTopicId = info.inboundTopicId;
            this.logger.info(`Loaded registration info: inbound topic ${this.inboundTopicId}`);
        }
        catch (error) {
            this.logger.error('Failed to load registration info:', error);
            throw new Error('Agent not properly registered');
        }
    }
    /**
     * Load existing connections
     */
    async loadConnections() {
        try {
            const data = await fs.readFile(CONNECTIONS_FILE, 'utf8').catch(() => '[]');
            const connections = JSON.parse(data);
            // Reset the map
            this.connections.clear();
            // Add all connections to the map
            for (const connection of connections) {
                this.connections.set(connection.requesterId, connection.connectionTopicId);
            }
            this.logger.info(`Loaded ${this.connections.size} existing connections`);
        }
        catch (error) {
            this.logger.error('Failed to load connections, starting with empty set:', error);
            // Initialize with empty connections
            this.connections.clear();
        }
    }
    /**
     * Start listening for connection requests on the inbound topic
     */
    async startListening() {
        if (this.isListening) {
            this.logger.warn('Already listening for connection requests');
            return true;
        }
        if (!this.inboundTopicId) {
            this.logger.error('Cannot start listening: inbound topic ID is missing');
            return false;
        }
        try {
            this.logger.info(`Starting to monitor inbound topic: ${this.inboundTopicId}`);
            // Set up a subscription to the agent's inbound topic
            // Using getMessageStream to set up the subscription
            const messageStreamResult = await this.client.getMessageStream(this.inboundTopicId);
            // Process each message from the messages array
            for (const message of messageStreamResult.messages) {
                this.logger.debug(`Processing message on inbound topic: ${JSON.stringify(message)}`);
                try {
                    // Get the message content, handling both possible property names
                    const messageContent = this.getMessageContent(message);
                    if (!messageContent) {
                        this.logger.warn('Message has no content or contents property');
                        continue;
                    }
                    // Parse the message content
                    const content = JSON.parse(messageContent);
                    // Check if this is a connection request
                    if (content.p === 'hcs-10' && content.op === 'connection_request') {
                        await this.handleConnectionRequest(content, message.sequence_number);
                    }
                }
                catch (error) {
                    this.logger.error('Error processing inbound message:', error);
                }
            }
            // Also set up a continuous subscription for new messages that arrive after our initial fetch
            // This would require implementing a callback or polling mechanism
            // For simplicity in this implementation, we'll just periodically re-check for new messages
            setInterval(async () => {
                if (!this.isListening || !this.inboundTopicId)
                    return;
                try {
                    const latestMessages = await this.client.getMessageStream(this.inboundTopicId);
                    for (const message of latestMessages.messages) {
                        try {
                            // Get the message content, handling both possible property names
                            const messageContent = this.getMessageContent(message);
                            if (!messageContent) {
                                this.logger.warn('Message has no content or contents property');
                                continue;
                            }
                            // Parse the message content
                            const content = JSON.parse(messageContent);
                            // Check if this is a connection request
                            if (content.p === 'hcs-10' && content.op === 'connection_request') {
                                await this.handleConnectionRequest(content, message.sequence_number);
                            }
                        }
                        catch (error) {
                            this.logger.error('Error processing inbound message:', error);
                        }
                    }
                }
                catch (error) {
                    this.logger.error('Error polling for new messages:', error);
                }
            }, 10000); // Poll every 10 seconds
            this.isListening = true;
            this.logger.info('Successfully started listening for connection requests');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to start listening for connection requests:', error);
            return false;
        }
    }
    /**
     * Helper method to safely extract message content from an HCS message
     * Handles both 'content' and 'contents' property names that may be present at runtime
     */
    getMessageContent(message) {
        // Use type assertion and optional chaining for safer property access
        const msg = message;
        if (typeof msg?.content === 'string') {
            return msg.content;
        }
        if (typeof msg?.contents === 'string') {
            return msg.contents;
        }
        // If message has data property (some SDK versions use this)
        if (typeof msg?.data === 'string') {
            return msg.data;
        }
        return null;
    }
    /**
     * Handle a connection request
     * @param message The connection request message
     * @param sequenceNumber The sequence number of the message
     */
    async handleConnectionRequest(message, sequenceNumber) {
        try {
            if (!message.operator_id) {
                this.logger.error('Invalid connection request - missing operator_id');
                return;
            }
            // Extract the requester info from operator_id (format: inboundTopicId@accountId)
            const operatorIdParts = message.operator_id.split('@');
            if (operatorIdParts.length !== 2) {
                this.logger.error(`Invalid operator_id format: ${message.operator_id}`);
                return;
            }
            const requesterId = operatorIdParts[1]; // Account ID
            const requesterInboundTopic = operatorIdParts[0]; // Inbound topic
            this.logger.info(`Processing connection request from ${requesterId} (sequence: ${sequenceNumber})`);
            // Check if we already have a connection with this requester
            if (this.connections.has(requesterId)) {
                this.logger.info(`Already have connection with ${requesterId}, will reuse existing connection`);
                // We could handle reconnection logic here in a more advanced implementation
            }
            // Call the client to handle the connection request
            // This automatically creates a new connection topic and responds with connection_created
            const result = await this.client.handleConnectionRequest(this.inboundTopicId, requesterId, sequenceNumber);
            if (result.connectionTopicId) {
                // Store the new connection
                this.connections.set(requesterId, result.connectionTopicId);
                this.logger.info(`Connection established with ${requesterId} on topic ${result.connectionTopicId}`);
                // Save the updated connections
                await this.saveConnections();
            }
            else {
                this.logger.error('Failed to handle connection request - no connection topic ID returned');
            }
        }
        catch (error) {
            this.logger.error('Error handling connection request:', error);
        }
    }
    /**
     * Save the current connections to a file
     */
    async saveConnections() {
        try {
            // Convert the map to an array of objects
            const connections = Array.from(this.connections.entries()).map(([requesterId, connectionTopicId]) => ({
                requesterId,
                connectionTopicId
            }));
            // Save to file
            await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
            this.logger.info(`Saved ${connections.length} connections to file`);
        }
        catch (error) {
            this.logger.error('Failed to save connections:', error);
        }
    }
    /**
     * Get all active connections
     */
    getConnections() {
        return new Map(this.connections);
    }
    /**
     * Get connection topic ID for a specific requester
     * @param requesterId The requester's account ID
     */
    getConnectionTopicId(requesterId) {
        return this.connections.get(requesterId);
    }
}
// Export factory function
export function createConnectionHandler(client) {
    return new ConnectionHandlerService(client);
}
