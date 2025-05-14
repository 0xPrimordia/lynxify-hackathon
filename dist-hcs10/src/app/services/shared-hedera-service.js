import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId, AccountId, TopicMessageQuery } from "@hashgraph/sdk";
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
/**
 * SharedHederaService
 *
 * A consolidated service that handles all Hedera interactions for both
 * business logic operations and HCS-10 protocol communications.
 */
export class SharedHederaService extends EventEmitter {
    /**
     * Constructor
     * @param config Configuration for the Hedera service
     */
    constructor(config) {
        super();
        this.subscriptions = new Map();
        this.topicCallbacks = new Map();
        this.initialized = false;
        this.isInitializing = false;
        this.isShuttingDown = false;
        // Standard topic IDs
        this.topics = {
            // Business logic topics
            GOVERNANCE: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '',
            PRICE_FEED: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC || '',
            AGENT_ACTIONS: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '',
            // HCS-10 protocol topics
            REGISTRY: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC || '',
            AGENT: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '',
            INBOUND: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '',
            OUTBOUND: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '',
            PROFILE: process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC || ''
        };
        this.client = this.initializeClient(config);
    }
    /**
     * Initialize the Hedera client
     * @param config Optional configuration
     * @returns Initialized Hedera client
     */
    initializeClient(config) {
        console.log('🚀 Initializing Hedera client...');
        let client;
        // Get configuration or use environment variables
        const network = config?.network || 'testnet';
        const operatorId = config?.operatorId || process.env.NEXT_PUBLIC_OPERATOR_ID;
        const operatorKey = config?.operatorKey || process.env.OPERATOR_KEY;
        const maxQueryPayment = config?.maxQueryPayment || 2;
        // Validate required credentials
        if (!operatorId || !operatorKey) {
            throw new Error('Missing required Hedera credentials: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
        }
        // Create client based on network type
        if (network === 'testnet') {
            client = Client.forTestnet();
            console.log('✅ Created client for Hedera testnet');
        }
        else if (network === 'mainnet') {
            // For SDK compatibility, we'll use a different approach for mainnet
            client = Client.forTestnet(); // Replace with mainnet when available
            console.log('⚠️ Using testnet client as mainnet placeholder');
        }
        else if (network === 'custom' && config?.customNetwork) {
            // For custom networks, use a different approach
            client = Client.forTestnet(); // Replace with custom network when available
            console.log('⚠️ Using testnet client as custom network placeholder');
        }
        else {
            throw new Error(`Invalid network configuration: ${network}`);
        }
        // Set operator information
        try {
            client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
            console.log(`✅ Set operator: ${operatorId}`);
        }
        catch (error) {
            console.error('❌ Failed to set operator:', error);
            throw error;
        }
        // Set maximum query payment (handle SDK compatibility)
        try {
            // @ts-ignore - Allow setMaxQueryPayment if it exists
            if (typeof client.setMaxQueryPayment === 'function') {
                // @ts-ignore - Allow setMaxQueryPayment if it exists
                client.setMaxQueryPayment(maxQueryPayment);
                console.log(`✅ Set max query payment: ${maxQueryPayment} HBAR`);
            }
        }
        catch (error) {
            console.warn('⚠️ Could not set max query payment:', error);
        }
        return client;
    }
    /**
     * Get the Hedera client instance
     * @returns The Hedera client
     */
    getClient() {
        return this.client;
    }
    /**
     * Initialize the service and verify topic configurations
     */
    async initialize() {
        if (this.initialized || this.isInitializing) {
            return;
        }
        this.isInitializing = true;
        try {
            console.log('🔄 Initializing SharedHederaService...');
            // Verify topics exist and create them if necessary
            await this.verifyTopics();
            // Add shutdown handlers
            this.setupShutdownHandlers();
            this.initialized = true;
            this.isInitializing = false;
            console.log('✅ SharedHederaService initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.isInitializing = false;
            console.error('❌ Failed to initialize SharedHederaService:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Setup handlers for graceful shutdown
     */
    setupShutdownHandlers() {
        // Handle process termination signals
        process.on('SIGINT', async () => {
            await this.shutdown();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await this.shutdown();
            process.exit(0);
        });
    }
    /**
     * Shutdown the service gracefully
     */
    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        console.log('🛑 Shutting down SharedHederaService...');
        try {
            // Unsubscribe from all topics - using Array.from for compatibility
            const topicIds = Array.from(this.subscriptions.keys());
            for (const topicId of topicIds) {
                await this.unsubscribeFromTopic(topicId);
            }
            // Clear all callbacks
            this.topicCallbacks.clear();
            console.log('✅ SharedHederaService shut down successfully');
            this.emit('shutdown');
        }
        catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
        finally {
            this.isShuttingDown = false;
        }
    }
    /**
     * Verify topic configurations and create missing topics
     */
    async verifyTopics() {
        console.log('🔄 Verifying topic configurations...');
        // Check if we need to create any business logic topics
        if (!this.topics.GOVERNANCE || this.topics.GOVERNANCE === '0.0.0') {
            console.log('ℹ️ Creating governance topic...');
            this.topics.GOVERNANCE = await this.createTopic('Lynxify Governance Topic');
        }
        if (!this.topics.PRICE_FEED || this.topics.PRICE_FEED === '0.0.0') {
            console.log('ℹ️ Creating price feed topic...');
            this.topics.PRICE_FEED = await this.createTopic('Lynxify Price Feed Topic');
        }
        if (!this.topics.AGENT_ACTIONS || this.topics.AGENT_ACTIONS === '0.0.0') {
            console.log('ℹ️ Creating agent actions topic...');
            this.topics.AGENT_ACTIONS = await this.createTopic('Lynxify Agent Actions Topic');
        }
        // HCS-10 specific topics are typically created during registration
        // We don't need to create them here, just log their status
        if (!this.topics.INBOUND || this.topics.INBOUND === '0.0.0') {
            console.log('⚠️ Missing HCS-10 inbound topic');
        }
        else {
            console.log(`ℹ️ Using HCS-10 inbound topic: ${this.topics.INBOUND}`);
        }
        if (!this.topics.OUTBOUND || this.topics.OUTBOUND === '0.0.0') {
            console.log('⚠️ Missing HCS-10 outbound topic');
        }
        else {
            console.log(`ℹ️ Using HCS-10 outbound topic: ${this.topics.OUTBOUND}`);
        }
        console.log('✅ Topic verification completed');
    }
    /**
     * Create a new HCS topic
     * @param memo Optional memo for the topic
     * @returns The newly created topic ID as a string
     */
    async createTopic(memo) {
        console.log(`🔄 Creating new HCS topic${memo ? ` with memo: ${memo}` : ''}...`);
        try {
            // Create a new topic transaction
            const transaction = new TopicCreateTransaction();
            // Set memo if provided
            if (memo) {
                transaction.setTopicMemo(memo);
            }
            // Execute transaction
            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            if (!receipt.topicId) {
                throw new Error('Failed to create topic: No topic ID in receipt');
            }
            const topicId = receipt.topicId.toString();
            console.log(`✅ Created topic: ${topicId}`);
            return topicId;
        }
        catch (error) {
            console.error('❌ Error creating topic:', error);
            throw error;
        }
    }
    /**
     * Send a message to a specific topic
     * @param topicId The topic ID to send the message to
     * @param message The message to send (will be stringified if object)
     * @returns Transaction details
     */
    async sendMessage(topicId, message) {
        const messageContent = typeof message === 'string' ? message : JSON.stringify(message);
        console.log(`🔄 Sending message to topic ${topicId}...`);
        try {
            // Create message submit transaction
            const transaction = new TopicMessageSubmitTransaction()
                .setTopicId(TopicId.fromString(topicId))
                .setMessage(messageContent);
            // Execute transaction
            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            // Extract transaction ID safely
            let transactionId = "unknown";
            try {
                // @ts-ignore - Handle different SDK versions
                transactionId = response.transactionId ? response.transactionId.toString() : response.toString();
            }
            catch (error) {
                console.warn('⚠️ Could not extract transaction ID:', error);
            }
            console.log(`✅ Message sent to topic ${topicId}`);
            console.log(`🔍 Transaction ID: ${transactionId}`);
            return {
                transactionId,
                success: true
            };
        }
        catch (error) {
            console.error(`❌ Error sending message to topic ${topicId}:`, error);
            throw error;
        }
    }
    /**
     * Subscribe to a topic for messages
     * @param topicId The topic ID to subscribe to
     * @param callback Callback function to handle incoming messages
     */
    async subscribeToTopic(topicId, callback) {
        console.log(`🔄 Subscribing to topic: ${topicId}...`);
        // Check if we're already subscribed
        if (this.subscriptions.has(topicId)) {
            console.log(`ℹ️ Already subscribed to topic ${topicId}, adding callback`);
            // Add additional callback
            if (!this.topicCallbacks.has(topicId)) {
                this.topicCallbacks.set(topicId, new Set());
            }
            this.topicCallbacks.get(topicId).add(callback);
            return;
        }
        try {
            // Initialize callbacks set
            if (!this.topicCallbacks.has(topicId)) {
                this.topicCallbacks.set(topicId, new Set());
            }
            // Add callback
            this.topicCallbacks.get(topicId).add(callback);
            // Create topic message query
            const topicMessageQuery = new TopicMessageQuery()
                .setTopicId(TopicId.fromString(topicId));
            // Subscribe to the topic
            const subscription = topicMessageQuery.subscribe(this.client, (message) => {
                if (!message) {
                    console.warn(`⚠️ Received null message from topic ${topicId}`);
                    return;
                }
                try {
                    // Cast to extended message type for property access
                    const extMessage = message;
                    // Parse message contents - handle SDK differences safely
                    let msgContents;
                    try {
                        msgContents = Buffer.from(extMessage.contents || extMessage.content || new Uint8Array()).toString();
                    }
                    catch (error) {
                        console.warn(`⚠️ Could not extract contents from message:`, error);
                        msgContents = '';
                    }
                    let parsedContents;
                    try {
                        parsedContents = JSON.parse(msgContents);
                    }
                    catch (e) {
                        parsedContents = msgContents;
                    }
                    // Extract sequence number safely
                    let sequenceNumber = 0;
                    try {
                        sequenceNumber = extMessage.sequenceNumber ?
                            extMessage.sequenceNumber.toNumber() :
                            (extMessage.consensusTimestamp ? extMessage.consensusTimestamp.getTime() : Date.now());
                    }
                    catch (error) {
                        sequenceNumber = Date.now();
                    }
                    // Extract timestamp safely
                    let timestamp = new Date();
                    try {
                        timestamp = extMessage.consensusTimestamp ?
                            extMessage.consensusTimestamp.toDate() :
                            new Date();
                    }
                    catch (error) {
                        timestamp = new Date();
                    }
                    // Create standardized message object
                    const topicMessage = {
                        id: uuidv4(),
                        topicId: topicId,
                        contents: parsedContents,
                        sequenceNumber: sequenceNumber,
                        consensusTimestamp: timestamp,
                        raw: message
                    };
                    // Notify all callbacks - convert Set to Array for compatibility
                    const callbacks = this.topicCallbacks.get(topicId);
                    if (callbacks) {
                        Array.from(callbacks).forEach(cb => {
                            try {
                                cb(topicMessage);
                            }
                            catch (callbackError) {
                                console.error(`❌ Error in topic callback for ${topicId}:`, callbackError);
                            }
                        });
                    }
                    // Emit event for any listeners
                    this.emit('message', topicMessage);
                    this.emit(`message:${topicId}`, topicMessage);
                }
                catch (error) {
                    console.error(`❌ Error processing message from topic ${topicId}:`, error);
                }
            }, (error) => {
                console.error(`❌ Error in subscription to topic ${topicId}:`, error);
                // Attempt to resubscribe
                setTimeout(() => {
                    if (!this.isShuttingDown && this.subscriptions.has(topicId)) {
                        console.log(`🔄 Attempting to resubscribe to topic ${topicId}...`);
                        this.unsubscribeFromTopic(topicId)
                            .then(() => this.subscribeToTopic(topicId, callback))
                            .catch(e => console.error(`❌ Failed to resubscribe to topic ${topicId}:`, e));
                    }
                }, 5000);
            });
            // Store subscription
            this.subscriptions.set(topicId, subscription);
            console.log(`✅ Successfully subscribed to topic: ${topicId}`);
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to topic ${topicId}:`, error);
            throw error;
        }
    }
    /**
     * Unsubscribe from a topic
     * @param topicId The topic ID to unsubscribe from
     */
    async unsubscribeFromTopic(topicId) {
        console.log(`🔄 Unsubscribing from topic: ${topicId}...`);
        if (!this.subscriptions.has(topicId)) {
            console.log(`ℹ️ Not subscribed to topic ${topicId}`);
            return;
        }
        try {
            // Get subscription
            const subscription = this.subscriptions.get(topicId);
            // Unsubscribe
            if (subscription && typeof subscription.unsubscribe === 'function') {
                subscription.unsubscribe();
            }
            // Clean up
            this.subscriptions.delete(topicId);
            this.topicCallbacks.delete(topicId);
            console.log(`✅ Successfully unsubscribed from topic: ${topicId}`);
        }
        catch (error) {
            console.error(`❌ Error unsubscribing from topic ${topicId}:`, error);
            throw error;
        }
    }
    /**
     * Remove a specific callback from a topic subscription
     * @param topicId The topic ID
     * @param callback The callback function to remove
     */
    removeCallback(topicId, callback) {
        const callbacks = this.topicCallbacks.get(topicId);
        if (callbacks) {
            callbacks.delete(callback);
            console.log(`ℹ️ Removed callback from topic ${topicId}`);
            // If no callbacks remain, unsubscribe
            if (callbacks.size === 0) {
                this.unsubscribeFromTopic(topicId)
                    .catch(e => console.error(`❌ Error unsubscribing from topic ${topicId}:`, e));
            }
        }
    }
    /**
     * Format a topic ID string to ensure it's properly formatted
     * @param topicId The topic ID to format
     * @returns Properly formatted topic ID
     */
    formatTopicId(topicId) {
        // If it's already a valid topic ID format, return as is
        if (/^0\.0\.\d+$/.test(topicId)) {
            return topicId;
        }
        // If it's just a number, format as 0.0.NUMBER
        if (/^\d+$/.test(topicId)) {
            return `0.0.${topicId}`;
        }
        throw new Error(`Invalid topic ID format: ${topicId}`);
    }
    /**
     * Get the status of all topics
     * @returns Object containing topic status information
     */
    getTopicStatus() {
        const status = {};
        // Check business logic topics
        status.hasGovernanceTopic = Boolean(this.topics.GOVERNANCE && this.topics.GOVERNANCE !== '0.0.0');
        status.hasPriceFeedTopic = Boolean(this.topics.PRICE_FEED && this.topics.PRICE_FEED !== '0.0.0');
        status.hasAgentActionsTopic = Boolean(this.topics.AGENT_ACTIONS && this.topics.AGENT_ACTIONS !== '0.0.0');
        // Check HCS-10 topics
        status.hasInboundTopic = Boolean(this.topics.INBOUND && this.topics.INBOUND !== '0.0.0');
        status.hasOutboundTopic = Boolean(this.topics.OUTBOUND && this.topics.OUTBOUND !== '0.0.0');
        status.hasProfileTopic = Boolean(this.topics.PROFILE && this.topics.PROFILE !== '0.0.0');
        // Add topic IDs
        status.governanceTopic = this.topics.GOVERNANCE;
        status.priceFeedTopic = this.topics.PRICE_FEED;
        status.agentActionsTopic = this.topics.AGENT_ACTIONS;
        status.inboundTopic = this.topics.INBOUND;
        status.outboundTopic = this.topics.OUTBOUND;
        status.profileTopic = this.topics.PROFILE;
        // Add subscription status
        status.activeSubscriptions = Array.from(this.subscriptions.keys());
        return status;
    }
}
// Export a singleton instance only for non-test environments
export const sharedHederaService = process.env.NODE_ENV !== 'test' ?
    new SharedHederaService() :
    {};
