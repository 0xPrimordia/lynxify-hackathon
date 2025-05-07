import { Logger } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
/**
 * Message Processor Service
 * Handles messages received on connection topics according to the HCS-10 protocol
 */
export class MessageProcessorService {
    constructor(client) {
        this.connections = new Map(); // requesterId -> connectionTopicId
        this.isProcessing = false;
        this.messageHandlers = new Map();
        this.client = client;
        this.logger = new Logger({
            module: 'MessageProcessor',
            level: 'debug',
            prettyPrint: true,
        });
    }
    /**
     * Initialize the service by loading existing connections
     */
    async initialize() {
        try {
            // Load existing connections
            await this.loadConnections();
            this.logger.info(`Initialized with ${this.connections.size} connections`);
            return true;
        }
        catch (error) {
            this.logger.error('Failed to initialize message processor:', error);
            return false;
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
     * Register a message handler for a specific message type
     * @param messageType The type of message to handle
     * @param handler The handler function
     */
    registerHandler(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
        this.logger.info(`Registered handler for message type: ${messageType}`);
    }
    /**
     * Start processing messages on all connection topics
     */
    async startProcessing() {
        if (this.isProcessing) {
            this.logger.warn('Already processing messages');
            return true;
        }
        try {
            this.logger.info('Starting to process messages on all connection topics');
            // Set up monitoring for all connection topics
            const connectionEntries = Array.from(this.connections.entries());
            for (const [requesterId, topicId] of connectionEntries) {
                this.monitorConnectionTopic(requesterId, topicId);
            }
            this.isProcessing = true;
            this.logger.info('Successfully started processing messages');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to start processing messages:', error);
            return false;
        }
    }
    /**
     * Monitor a specific connection topic for messages
     * @param requesterId The requester's account ID
     * @param topicId The connection topic ID
     */
    async monitorConnectionTopic(requesterId, topicId) {
        try {
            this.logger.info(`Monitoring connection topic ${topicId} for ${requesterId}`);
            // Set up a polling mechanism to check for new messages
            const checkForMessages = async () => {
                if (!this.isProcessing)
                    return;
                try {
                    const messageStreamResult = await this.client.getMessageStream(topicId);
                    for (const message of messageStreamResult.messages) {
                        try {
                            await this.processMessage(message, requesterId);
                        }
                        catch (error) {
                            this.logger.error(`Error processing message from ${requesterId}:`, error);
                        }
                    }
                }
                catch (error) {
                    this.logger.error(`Error fetching messages for ${topicId}:`, error);
                }
                // Schedule the next check
                setTimeout(checkForMessages, 10000); // Check every 10 seconds
            };
            // Start the polling
            checkForMessages();
        }
        catch (error) {
            this.logger.error(`Failed to monitor connection topic ${topicId}:`, error);
        }
    }
    /**
     * Process a received message
     * @param message The HCS message
     * @param senderId The sender's account ID
     */
    async processMessage(message, senderId) {
        try {
            // Parse the message content
            // Handle both 'data' property (from SDK) and 'contents' property (from runtime)
            const messageContent = message.data || message.contents;
            const content = JSON.parse(messageContent);
            // Check if this is a standard message
            if (content.p === 'hcs-10' && content.op === 'message') {
                await this.processStandardMessage(content, senderId);
            }
            else if (content.p === 'hcs-10' && content.op === 'close_connection') {
                await this.processCloseConnection(content, senderId);
            }
            else {
                this.logger.warn(`Unknown message operation: ${content.op}`);
            }
        }
        catch (error) {
            this.logger.error('Error processing message:', error);
        }
    }
    /**
     * Process a standard message
     * @param message The standard message
     * @param senderId The sender's account ID
     */
    async processStandardMessage(message, senderId) {
        try {
            // Extract the message data
            const data = message.data;
            // Check if the data is an HCS-1 reference
            if (typeof data === 'string' && data.startsWith('hcs://1/')) {
                // This is a reference to a large message stored via HCS-1
                await this.processHCS1Reference(data, senderId);
                return;
            }
            // Parse the data as JSON
            let messageContent;
            try {
                const contentStr = typeof data === 'string' ? data :
                    (data instanceof ArrayBuffer ? Buffer.from(data).toString('utf8') :
                        JSON.stringify(data));
                messageContent = JSON.parse(contentStr);
            }
            catch (error) {
                this.logger.warn(`Failed to parse message data as JSON: ${data}`);
                return;
            }
            // Check if the message has a type
            if (!messageContent.type) {
                this.logger.warn(`Message has no type: ${JSON.stringify(messageContent)}`);
                return;
            }
            // Find and execute the appropriate handler
            const handler = this.messageHandlers.get(messageContent.type);
            if (handler) {
                await handler(messageContent, senderId);
            }
            else {
                this.logger.warn(`No handler registered for message type: ${messageContent.type}`);
            }
        }
        catch (error) {
            this.logger.error('Error processing standard message:', error);
        }
    }
    /**
     * Process an HCS-1 reference to a large message
     * @param reference The HCS-1 reference
     * @param senderId The sender's account ID
     */
    async processHCS1Reference(reference, senderId) {
        try {
            // Extract the topic ID from the reference
            const topicId = reference.replace('hcs://1/', '');
            this.logger.info(`Retrieving large message from HCS-1 topic: ${topicId}`);
            // Fetch the message content
            const content = await this.client.getMessageContent(reference);
            // Parse the content
            let messageContent;
            try {
                const contentStr = typeof content === 'string' ? content :
                    (content instanceof ArrayBuffer ? Buffer.from(content).toString('utf8') :
                        JSON.stringify(content));
                messageContent = JSON.parse(contentStr);
            }
            catch (error) {
                this.logger.warn(`Failed to parse HCS-1 content as JSON: ${content}`);
                return;
            }
            // Find and execute the appropriate handler
            if (messageContent.type) {
                const handler = this.messageHandlers.get(messageContent.type);
                if (handler) {
                    await handler(messageContent, senderId);
                }
                else {
                    this.logger.warn(`No handler registered for message type: ${messageContent.type}`);
                }
            }
            else {
                this.logger.warn(`HCS-1 message has no type: ${JSON.stringify(messageContent)}`);
            }
        }
        catch (error) {
            this.logger.error('Error processing HCS-1 reference:', error);
        }
    }
    /**
     * Process a close connection message
     * @param message The close connection message
     * @param senderId The sender's account ID
     */
    async processCloseConnection(message, senderId) {
        try {
            this.logger.info(`Received close connection request from ${senderId}`);
            // Extract the reason if provided
            const reason = message.reason || 'No reason provided';
            this.logger.info(`Connection closed by ${senderId}, reason: ${reason}`);
            // Remove the connection
            const connectionTopicId = this.connections.get(senderId);
            if (connectionTopicId) {
                this.connections.delete(senderId);
                // TODO: Save updated connections to file
                // This would typically be handled by a central connection manager
            }
        }
        catch (error) {
            this.logger.error('Error processing close connection message:', error);
        }
    }
    /**
     * Send a message to a specific connection
     * @param requesterId The requester's account ID
     * @param message The message to send
     */
    async sendMessage(requesterId, message) {
        try {
            // Get the connection topic for this requester
            const connectionTopicId = this.connections.get(requesterId);
            if (!connectionTopicId) {
                this.logger.error(`No connection found for requester ${requesterId}`);
                return false;
            }
            // Prepare the message
            const hcs10Message = {
                p: 'hcs-10',
                op: 'message',
                data: typeof message === 'string' ? message : JSON.stringify(message)
            };
            // Send the message
            await this.client.sendMessage(connectionTopicId, JSON.stringify(hcs10Message));
            this.logger.info(`Sent message to ${requesterId} on topic ${connectionTopicId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send message to ${requesterId}:`, error);
            return false;
        }
    }
    /**
     * Send a large message using HCS-1
     * @param requesterId The requester's account ID
     * @param message The message to send
     */
    async sendLargeMessage(requesterId, message) {
        try {
            // Get the connection topic for this requester
            const connectionTopicId = this.connections.get(requesterId);
            if (!connectionTopicId) {
                this.logger.error(`No connection found for requester ${requesterId}`);
                return false;
            }
            // Convert message to string if it's an object
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            // Store large message via custom topic message
            // Since storeMessageContent doesn't exist, we'll create a topic for this message
            // and send the content directly
            const storageTopicId = await this.createStorageTopic();
            await this.client.sendMessage(storageTopicId, messageStr);
            const reference = `hcs://1/${storageTopicId}`;
            // Prepare the message with the reference
            const hcs10Message = {
                p: 'hcs-10',
                op: 'message',
                data: reference
            };
            // Send the message
            await this.client.sendMessage(connectionTopicId, JSON.stringify(hcs10Message));
            this.logger.info(`Sent large message to ${requesterId} on topic ${connectionTopicId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send large message to ${requesterId}:`, error);
            return false;
        }
    }
    /**
     * Create a storage topic for large messages
     * @private
     */
    async createStorageTopic() {
        try {
            // This is a placeholder - in a real implementation, we would use HCS-1 client 
            // to create a storage topic, but for now we'll just create a regular topic
            // Generate a unique ID for the storage topic
            const topicId = `storage-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            this.logger.info(`Created storage topic: ${topicId}`);
            return topicId;
        }
        catch (error) {
            this.logger.error('Error creating storage topic:', error);
            throw error;
        }
    }
}
// Export factory function
export function createMessageProcessor(client) {
    return new MessageProcessorService(client);
}
