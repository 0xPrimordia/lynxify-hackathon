import { EventEmitter } from 'events';
/**
 * HCS10AgentWithConnections
 * Enhanced HCS10Agent implementation that properly uses the ConnectionsManager from standards-sdk
 */
export class HCS10AgentWithConnections extends EventEmitter {
    /**
     * Create a new HCS10 agent with ConnectionsManager
     * @param client An HCS10Client instance
     * @param inboundTopicId The agent's inbound topic ID
     * @param outboundTopicId The agent's outbound topic ID
     * @param agentId The agent's ID (usually an account ID)
     */
    constructor(client, inboundTopicId, outboundTopicId, agentId) {
        super();
        this.connectionsManager = null;
        this.pollingInterval = null;
        this.lastSequence = {};
        this.isConnectionsManagerInitialized = false;
        this.initAttempted = false;
        // Cast client to extended interface
        this.client = client;
        this.inboundTopicId = inboundTopicId;
        this.outboundTopicId = outboundTopicId;
        this.agentId = agentId || '';
        // Initialize the connections manager asynchronously
        this.initializeConnectionsManager();
    }
    /**
     * Initialize the ConnectionsManager using proper ES Module import
     */
    async initializeConnectionsManager() {
        if (this.initAttempted)
            return;
        this.initAttempted = true;
        try {
            // Verify client implements required methods for ConnectionsManager
            if (typeof this.client.retrieveCommunicationTopics !== 'function' ||
                typeof this.client.getMessages !== 'function') {
                throw new Error('Client missing required methods for ConnectionsManager');
            }
            console.log('🔄 Initializing ConnectionsManager...');
            // Create an adapted client that conforms to what ConnectionsManager expects
            const adaptedClient = {
                // Original client methods
                ...this.client,
                // Required methods for ConnectionsManager
                retrieveCommunicationTopics: this.client.retrieveCommunicationTopics.bind(this.client),
                getMessages: this.client.getMessages.bind(this.client),
                // Required properties that might be missing
                network: this.client.network || 'testnet',
                operatorId: this.client.operatorId || this.agentId,
                // Default methods if not provided by client
                getMirrorClient: this.client.getMirrorClient || (() => ({
                    getTopicMessages: async () => ({ messages: [] })
                }))
            };
            try {
                // Import the module dynamically using a more flexible approach
                const importedModule = await import('@hashgraphonline/standards-sdk');
                // Cast to any to bypass TypeScript restrictions on dynamic imports
                const sdkModule = importedModule;
                // Check if ConnectionsManager exists
                if (!sdkModule || typeof sdkModule.ConnectionsManager !== 'function') {
                    throw new Error('ConnectionsManager not found in standards-sdk module');
                }
                // Create ConnectionsManager instance
                const cmConstructor = sdkModule.ConnectionsManager;
                this.connectionsManager = new cmConstructor({
                    baseClient: adaptedClient,
                    logLevel: 'info'
                });
                console.log('✅ ConnectionsManager initialized with ES Module import');
            }
            catch (error) {
                console.error('Failed to import ConnectionsManager:', error instanceof Error ? error.message : String(error));
                throw error;
            }
            // Set agent info in the ConnectionsManager
            if (this.connectionsManager && this.agentId) {
                await this.connectionsManager.setAgentInfo({
                    accountId: this.agentId,
                    inboundTopicId: this.inboundTopicId,
                    outboundTopicId: this.outboundTopicId
                });
                // Fetch existing connections
                await this.connectionsManager.fetchConnectionData(this.agentId);
                this.isConnectionsManagerInitialized = true;
                console.log('✅ ConnectionsManager fully initialized with agent info');
                // Emit an event to notify that ConnectionsManager is ready
                this.emit('connectionsManagerReady');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize ConnectionsManager:', error instanceof Error ? error.message : String(error));
            this.emit('connectionsManagerError', error);
            // Continue without ConnectionsManager functionality
        }
    }
    /**
     * Start polling for messages
     * @param pollingIntervalMs Polling interval in milliseconds
     */
    start(pollingIntervalMs = 5000) {
        console.log(`🚀 Starting HCS10AgentWithConnections with polling interval ${pollingIntervalMs}ms`);
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        // Initialize sequence numbers
        this.lastSequence[this.inboundTopicId] = 0;
        // Start polling
        this.pollingInterval = setInterval(() => {
            this.pollForMessages();
        }, pollingIntervalMs);
        // Poll once immediately
        this.pollForMessages();
    }
    /**
     * Stop polling for messages
     */
    stop() {
        console.log('🛑 Stopping HCS10AgentWithConnections');
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    /**
     * Poll for new messages
     */
    async pollForMessages() {
        try {
            // Get new messages from the inbound topic
            const response = await this.client.getMessageStream(this.inboundTopicId);
            // Process messages with ConnectionsManager if available
            if (this.isConnectionsManagerInitialized && this.connectionsManager) {
                try {
                    await this.connectionsManager.processInboundMessages(response.messages);
                    // Process pending connection requests
                    await this.processPendingRequests();
                }
                catch (error) {
                    console.error('❌ Error processing messages with ConnectionsManager:', error instanceof Error ? error.message : String(error));
                    // If ConnectionsManager fails, fall back to direct processing
                    this.processSingleMessages(response);
                }
            }
            else {
                // If ConnectionsManager is not available, process messages directly
                this.processSingleMessages(response);
            }
        }
        catch (error) {
            console.error('Error polling for messages:', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Process messages directly without ConnectionsManager
     */
    processSingleMessages(response) {
        for (const message of response.messages) {
            // Skip messages we've already processed
            if (message.sequence_number <= (this.lastSequence[this.inboundTopicId] || 0)) {
                continue;
            }
            // Update last sequence number
            this.lastSequence[this.inboundTopicId] = message.sequence_number;
            // Emit the message
            this.emit('message', message.contents, message);
        }
    }
    /**
     * Process pending connection requests
     */
    async processPendingRequests() {
        if (!this.connectionsManager)
            return;
        try {
            // Get pending requests
            const pendingRequests = this.connectionsManager.getPendingRequests();
            if (pendingRequests.length > 0) {
                console.log(`🔔 Found ${pendingRequests.length} pending connection requests`);
                // Auto-accept all pending requests
                for (const request of pendingRequests) {
                    console.log(`✅ Auto-accepting connection request from ${request.from || 'unknown'}`);
                    await this.connectionsManager.acceptConnectionRequest({
                        requestId: request.id || '',
                        memo: 'Automatically accepted by HCS10AgentWithConnections'
                    });
                    // Emit an event
                    this.emit('connectionAccepted', request);
                }
            }
        }
        catch (error) {
            console.error('❌ Error processing pending requests:', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get the ConnectionsManager instance
     */
    getConnectionsManager() {
        return this.connectionsManager;
    }
    /**
     * Check if the agent is ready (ConnectionsManager initialized)
     */
    isReady() {
        return this.isConnectionsManagerInitialized && this.connectionsManager !== null;
    }
    /**
     * Wait until the agent is ready
     * @param timeoutMs Timeout in milliseconds
     */
    async waitUntilReady(timeoutMs = 30000) {
        if (this.isReady())
            return true;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeoutMs);
            const readyHandler = () => {
                cleanup();
                resolve(true);
            };
            const errorHandler = () => {
                cleanup();
                resolve(false);
            };
            const cleanup = () => {
                clearTimeout(timeout);
                this.removeListener('connectionsManagerReady', readyHandler);
                this.removeListener('connectionsManagerError', errorHandler);
            };
            this.once('connectionsManagerReady', readyHandler);
            this.once('connectionsManagerError', errorHandler);
        });
    }
}
