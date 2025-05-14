import { WebSocketServer, WebSocket } from 'ws';
import { EventBus, EventType } from '../utils/event-emitter';
import { createServer } from 'http';
/**
 * UnifiedWebSocketService - Manages WebSocket connections and interfaces with LynxifyAgent
 *
 * This service provides a WebSocket interface for the unified agent architecture,
 * allowing clients to receive real-time updates and send commands to the agent.
 */
export class UnifiedWebSocketService {
    /**
     * Initialize WebSocket server
     * @param agent The LynxifyAgent instance
     * @param tokenService The TokenService instance
     * @param indexService The TokenizedIndexService instance
     * @param port Server port (default: 3001)
     * @param existingServer Optional existing HTTP server to attach to
     */
    constructor(agent, tokenService, indexService, port = 3001, existingServer) {
        this.httpServer = null; // Store the HTTP server reference
        this.externalServer = false; // Track if using an external server
        this.clients = new Set();
        this.statusUpdateInterval = null;
        this.lynxifyAgent = agent;
        this.tokenService = tokenService;
        this.indexService = indexService;
        this.eventBus = EventBus.getInstance();
        if (existingServer) {
            // Use the provided HTTP server
            console.log('🔌 WEBSOCKET: Using existing HTTP server');
            this.httpServer = existingServer;
            this.externalServer = true;
            // Create WebSocket server attached to the existing HTTP server
            this.wss = new WebSocketServer({ server: existingServer });
        }
        else {
            // Create a new HTTP server
            console.log('🔌 WEBSOCKET: Creating new HTTP server on port ' + port);
            this.httpServer = createServer((req, res) => {
                // Basic health check endpoint
                if (req.url === '/health' || req.url === '/' || req.url === '/api/health') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'ok',
                        service: 'lynxify-unified-agent',
                        uptime: Math.floor(process.uptime()),
                        timestamp: new Date().toISOString()
                    }));
                    return;
                }
                // Default response for other routes
                res.writeHead(404);
                res.end('Not found');
            });
            // Start the HTTP server - CRITICAL: Bind to 0.0.0.0 for Render
            this.httpServer.listen(port, '0.0.0.0', () => {
                console.log(`🌐 HTTP server listening at http://0.0.0.0:${port}`);
                console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
            });
            // Create WebSocket server attached to the HTTP server
            this.wss = new WebSocketServer({ server: this.httpServer });
        }
        // Handle connections
        this.wss.on('connection', this.handleConnection.bind(this));
        // Set up event listeners
        this.setupEventListeners();
        // Start periodic status updates
        this.startStatusUpdates();
        console.log(`🔌 WEBSOCKET: Unified server started on port ${port}`);
    }
    /**
     * Handle new WebSocket connections
     */
    handleConnection(ws) {
        console.log('🔌 WEBSOCKET: Client connected');
        this.clients.add(ws);
        // Send welcome message with agent status
        this.sendToClient(ws, {
            type: 'system',
            data: {
                message: 'Connected to Lynxify Agent',
                status: 'connected'
            }
        });
        // Handle client messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleClientMessage(ws, data);
            }
            catch (error) {
                console.error('❌ WEBSOCKET: Error parsing message:', error);
                this.sendToClient(ws, {
                    type: 'error',
                    data: { message: 'Invalid message format' }
                });
            }
        });
        // Handle disconnection
        ws.on('close', () => {
            console.log('🔌 WEBSOCKET: Client disconnected');
            this.clients.delete(ws);
        });
        // Handle errors
        ws.on('error', (error) => {
            console.error('❌ WEBSOCKET: Client connection error:', error);
            this.clients.delete(ws);
        });
    }
    /**
     * Handle messages from clients
     */
    handleClientMessage(ws, message) {
        console.log(`📥 WEBSOCKET: Received message of type ${message.type}`);
        switch (message.type) {
            case 'get_agent_status':
                this.sendAgentStatus(ws);
                break;
            case 'token_operation':
                this.handleTokenOperation(ws, message.data);
                break;
            case 'rebalance_proposal':
                this.handleRebalanceProposal(ws, message.data);
                break;
            case 'ping':
                // Simple ping/pong for connection testing
                this.sendToClient(ws, {
                    type: 'pong',
                    data: {
                        timestamp: Date.now()
                    }
                });
                break;
            default:
                console.log(`ℹ️ WEBSOCKET: Unknown message type: ${message.type}`);
                this.sendToClient(ws, {
                    type: 'error',
                    data: { message: 'Unknown message type' }
                });
        }
    }
    /**
     * Handle token operation requests
     * Note: This is lower priority compared to the agent and HCS flow
     */
    handleTokenOperation(ws, data) {
        const { operation, token, amount } = data;
        if (!operation) {
            this.sendToClient(ws, {
                type: 'error',
                data: { message: 'Missing token operation' }
            });
            return;
        }
        switch (operation) {
            case 'get_balances':
                this.tokenService.getTokenBalances()
                    .then((balances) => {
                    this.sendToClient(ws, {
                        type: 'token_balances',
                        data: balances
                    });
                })
                    .catch((error) => {
                    console.error('❌ WEBSOCKET: Error getting token balances:', error);
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Failed to get token balances' }
                    });
                });
                break;
            case 'mint':
                if (!token || !amount) {
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Missing token or amount for mint operation' }
                    });
                    return;
                }
                console.log(`🔄 WEBSOCKET: Processing mint operation for ${amount} ${token}`);
                this.tokenService.mintTokens(token, amount)
                    .then((success) => {
                    console.log(`✅ WEBSOCKET: Mint operation ${success ? 'successful' : 'failed'}`);
                    // Send operation result
                    this.sendToClient(ws, {
                        type: 'token_operation_result',
                        data: {
                            operation: 'mint',
                            token,
                            amount,
                            success
                        }
                    });
                    // Emit token operation event
                    this.eventBus.emitEvent(EventType.TOKEN_OPERATION_EXECUTED, {
                        operation: 'mint',
                        token,
                        amount,
                        success,
                        timestamp: Date.now()
                    });
                    // Get updated balances and send back
                    return this.tokenService.getTokenBalances();
                })
                    .then((balances) => {
                    // Send updated balances
                    this.sendToClient(ws, {
                        type: 'token_balances',
                        data: balances
                    });
                })
                    .catch((error) => {
                    console.error('❌ WEBSOCKET: Error minting tokens:', error);
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Failed to mint tokens: ' + error.message }
                    });
                });
                break;
            case 'burn':
                if (!token || !amount) {
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Missing token or amount for burn operation' }
                    });
                    return;
                }
                console.log(`🔄 WEBSOCKET: Processing burn operation for ${amount} ${token}`);
                this.tokenService.burnTokens(token, amount)
                    .then((success) => {
                    console.log(`✅ WEBSOCKET: Burn operation ${success ? 'successful' : 'failed'}`);
                    // Send operation result
                    this.sendToClient(ws, {
                        type: 'token_operation_result',
                        data: {
                            operation: 'burn',
                            token,
                            amount,
                            success
                        }
                    });
                    // Emit token operation event
                    this.eventBus.emitEvent(EventType.TOKEN_OPERATION_EXECUTED, {
                        operation: 'burn',
                        token,
                        amount,
                        success,
                        timestamp: Date.now()
                    });
                    // Get updated balances and send back
                    return this.tokenService.getTokenBalances();
                })
                    .then((balances) => {
                    // Send updated balances
                    this.sendToClient(ws, {
                        type: 'token_balances',
                        data: balances
                    });
                })
                    .catch((error) => {
                    console.error('❌ WEBSOCKET: Error burning tokens:', error);
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Failed to burn tokens: ' + error.message }
                    });
                });
                break;
            default:
                console.log(`ℹ️ WEBSOCKET: Unknown token operation: ${operation}`);
                this.sendToClient(ws, {
                    type: 'error',
                    data: { message: 'Unknown token operation' }
                });
        }
    }
    /**
     * Handle rebalance proposal requests
     */
    handleRebalanceProposal(ws, data) {
        const { weights } = data;
        if (!weights || typeof weights !== 'object') {
            this.sendToClient(ws, {
                type: 'error',
                data: { message: 'Missing or invalid weights for rebalance proposal' }
            });
            return;
        }
        this.eventBus.emitEvent(EventType.INDEX_REBALANCE_PROPOSED, {
            proposalId: `proposal-${Date.now()}`,
            newWeights: weights,
            trigger: 'scheduled'
        });
        this.sendToClient(ws, {
            type: 'rebalance_proposal_created',
            data: {
                weights,
                message: 'Rebalance proposal submitted'
            }
        });
    }
    /**
     * Set up event listeners for agent events
     */
    setupEventListeners() {
        // System events
        this.eventBus.onEvent(EventType.SYSTEM_INITIALIZED, () => {
            this.broadcastToAll({
                type: 'system_status',
                data: {
                    status: 'initialized',
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.SYSTEM_ERROR, (error) => {
            this.broadcastToAll({
                type: 'system_error',
                data: {
                    message: error.message || 'Unknown error',
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.SYSTEM_SHUTDOWN, () => {
            this.broadcastToAll({
                type: 'system_status',
                data: {
                    status: 'shutdown',
                    timestamp: Date.now()
                }
            });
        });
        // Listen for HCS messages
        this.eventBus.onEvent(EventType.MESSAGE_RECEIVED, (data) => {
            this.broadcastToAll({
                type: 'hcs_message',
                data: {
                    topicId: data.topicId,
                    contents: data.contents,
                    timestamp: data.consensusTimestamp
                }
            });
        });
        this.eventBus.onEvent(EventType.MESSAGE_SENT, (data) => {
            this.broadcastToAll({
                type: 'hcs_message_sent',
                data: {
                    topicId: data.topicId,
                    transactionId: data.transactionId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.MESSAGE_ERROR, (data) => {
            this.broadcastToAll({
                type: 'hcs_message_error',
                data: {
                    topicId: data.topicId,
                    error: data.error.message || 'Unknown error',
                    timestamp: Date.now()
                }
            });
        });
        // HCS10 Protocol events
        this.eventBus.onEvent(EventType.HCS10_AGENT_REGISTERED, (data) => {
            this.broadcastToAll({
                type: 'agent_registered',
                data: {
                    agentId: data.agentId,
                    registryTopicId: data.registryTopicId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HCS10_AGENT_CONNECTED, (data) => {
            this.broadcastToAll({
                type: 'agent_connected',
                data: {
                    agentId: data.agentId,
                    capabilities: data.capabilities,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HCS10_AGENT_DISCONNECTED, (data) => {
            this.broadcastToAll({
                type: 'agent_disconnected',
                data: {
                    agentId: data.agentId,
                    reason: data.reason || 'Unknown reason',
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HCS10_REQUEST_RECEIVED, (data) => {
            this.broadcastToAll({
                type: 'agent_request_received',
                data: {
                    requestId: data.requestId,
                    senderId: data.senderId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HCS10_RESPONSE_SENT, (data) => {
            this.broadcastToAll({
                type: 'agent_response_sent',
                data: {
                    requestId: data.requestId,
                    recipientId: data.recipientId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HCS10_RESPONSE_RECEIVED, (data) => {
            this.broadcastToAll({
                type: 'agent_response_received',
                data: {
                    requestId: data.requestId,
                    senderId: data.senderId,
                    timestamp: Date.now()
                }
            });
        });
        // Tokenized Index events
        this.eventBus.onEvent(EventType.INDEX_REBALANCE_PROPOSED, (data) => {
            this.broadcastToAll({
                type: 'rebalance_proposed',
                data: {
                    proposalId: data.proposalId,
                    newWeights: data.newWeights,
                    trigger: data.trigger,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_REBALANCE_APPROVED, (data) => {
            this.broadcastToAll({
                type: 'rebalance_approved',
                data: {
                    proposalId: data.proposalId,
                    approvedAt: data.approvedAt,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_REBALANCE_EXECUTED, (data) => {
            this.broadcastToAll({
                type: 'rebalance_executed',
                data: {
                    proposalId: data.proposalId,
                    preBalances: data.preBalances,
                    postBalances: data.postBalances,
                    executedAt: data.executedAt,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_PRICE_UPDATED, (data) => {
            this.broadcastToAll({
                type: 'price_updated',
                data: {
                    tokenId: data.tokenId,
                    price: data.price,
                    source: data.source,
                    timestamp: Date.now()
                }
            });
        });
        // Token operation events
        this.eventBus.onEvent(EventType.TOKEN_OPERATION_EXECUTED, (data) => {
            this.broadcastToAll({
                type: 'token_operation_executed',
                data: {
                    operation: data.operation,
                    token: data.token,
                    amount: data.amount,
                    success: data.success,
                    timestamp: data.timestamp
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_RISK_ALERT, (data) => {
            this.broadcastToAll({
                type: 'risk_alert',
                data: {
                    severity: data.severity,
                    riskDescription: data.riskDescription,
                    affectedTokens: data.affectedTokens,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_POLICY_CHANGED, (data) => {
            this.broadcastToAll({
                type: 'policy_changed',
                data: {
                    policyId: data.policyId,
                    changes: data.changes,
                    effectiveFrom: data.effectiveFrom,
                    timestamp: Date.now()
                }
            });
        });
        // Governance events
        this.eventBus.onEvent(EventType.INDEX_PROPOSAL_CREATED, (data) => {
            this.broadcastToAll({
                type: 'proposal_created',
                data: {
                    proposalId: data.proposalId,
                    type: data.type,
                    creator: data.creator,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_PROPOSAL_VOTED, (data) => {
            this.broadcastToAll({
                type: 'proposal_voted',
                data: {
                    proposalId: data.proposalId,
                    voter: data.voter,
                    voteType: data.voteType,
                    weight: data.weight,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_PROPOSAL_EXECUTED, (data) => {
            this.broadcastToAll({
                type: 'proposal_executed',
                data: {
                    proposalId: data.proposalId,
                    executedAt: data.executedAt,
                    success: data.success,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_TOKEN_ADDED, (data) => {
            this.broadcastToAll({
                type: 'token_added',
                data: {
                    tokenId: data.tokenId,
                    tokenSymbol: data.tokenSymbol,
                    initialWeight: data.initialWeight,
                    addedAt: data.addedAt,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.INDEX_TOKEN_REMOVED, (data) => {
            this.broadcastToAll({
                type: 'token_removed',
                data: {
                    tokenId: data.tokenId,
                    removedAt: data.removedAt,
                    timestamp: Date.now()
                }
            });
        });
        // Hedera service events
        this.eventBus.onEvent(EventType.HEDERA_TOPIC_CREATED, (data) => {
            this.broadcastToAll({
                type: 'topic_created',
                data: {
                    topicId: data.topicId,
                    memo: data.memo,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HEDERA_TOPIC_SUBSCRIBED, (data) => {
            this.broadcastToAll({
                type: 'topic_subscribed',
                data: {
                    topicId: data.topicId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HEDERA_TOPIC_UNSUBSCRIBED, (data) => {
            this.broadcastToAll({
                type: 'topic_unsubscribed',
                data: {
                    topicId: data.topicId,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HEDERA_TRANSACTION_SUBMITTED, (data) => {
            this.broadcastToAll({
                type: 'transaction_submitted',
                data: {
                    transactionId: data.transactionId,
                    type: data.type,
                    timestamp: Date.now()
                }
            });
        });
        this.eventBus.onEvent(EventType.HEDERA_TRANSACTION_CONFIRMED, (data) => {
            this.broadcastToAll({
                type: 'transaction_confirmed',
                data: {
                    transactionId: data.transactionId,
                    type: data.type,
                    timestamp: Date.now()
                }
            });
            // Special handling for token transactions
            if (data.type.startsWith('token_')) {
                this.broadcastToAll({
                    type: 'token_transaction',
                    data: {
                        transactionId: data.transactionId,
                        operation: data.type.replace('token_', ''),
                        status: 'confirmed',
                        timestamp: Date.now()
                    }
                });
            }
        });
        this.eventBus.onEvent(EventType.HEDERA_TRANSACTION_FAILED, (data) => {
            this.broadcastToAll({
                type: 'transaction_failed',
                data: {
                    transactionId: data.transactionId,
                    type: data.type,
                    error: data.error.message || 'Unknown error',
                    timestamp: Date.now()
                }
            });
        });
    }
    /**
     * Broadcast message to all connected clients
     */
    broadcastToAll(message) {
        const jsonMessage = JSON.stringify(message);
        Array.from(this.clients).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(jsonMessage);
                }
                catch (error) {
                    console.error('❌ WEBSOCKET: Error broadcasting message:', error);
                }
            }
        });
    }
    /**
     * Send message to a specific client
     */
    sendToClient(client, message) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
            }
            catch (error) {
                console.error('❌ WEBSOCKET: Error sending message to client:', error);
            }
        }
    }
    /**
     * Close the WebSocket server
     */
    close() {
        // Stop status update interval
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
        // Close WebSocket server
        this.wss.close();
        // Only close the HTTP server if we created it 
        if (this.httpServer && !this.externalServer) {
            this.httpServer.close();
        }
        console.log('🔌 WEBSOCKET: Unified server closed');
    }
    /**
     * Send comprehensive agent status to a client
     */
    async sendAgentStatus(ws) {
        try {
            // Get agent configuration
            const config = this.lynxifyAgent.getConfig();
            // Get token balances
            const tokenBalances = await this.tokenService.getTokenBalances();
            // Compile complete agent status
            const status = {
                agent: {
                    id: config.agentId,
                    initialized: this.lynxifyAgent.isInitialized(),
                    network: config.hederaConfig.network
                },
                hcs10: {
                    registered: true, // If the agent is running, it's been registered
                    registryTopicId: config.hcs10Config.registryTopicId,
                    agentTopicId: config.hcs10Config.agentTopicId,
                    capabilities: config.hcs10Config.capabilities
                },
                tokens: {
                    balances: tokenBalances
                },
                timestamp: Date.now()
            };
            // Send status to client
            this.sendToClient(ws, {
                type: 'agent_status',
                data: status
            });
        }
        catch (error) {
            console.error('❌ WEBSOCKET: Error sending agent status:', error);
            this.sendToClient(ws, {
                type: 'error',
                data: { message: 'Failed to get agent status: ' + error.message }
            });
        }
    }
    /**
     * Start periodic status updates
     */
    startStatusUpdates() {
        this.statusUpdateInterval = setInterval(async () => {
            if (this.clients.size === 0)
                return; // No clients connected
            try {
                // Get agent configuration
                const config = this.lynxifyAgent.getConfig();
                // Get token balances (but don't wait if it takes too long)
                let tokenBalances = {};
                try {
                    tokenBalances = await Promise.race([
                        this.tokenService.getTokenBalances(),
                        new Promise((resolve) => setTimeout(() => resolve({}), 1000) // Timeout after 1 second
                        )
                    ]);
                }
                catch (err) {
                    console.warn('⚠️ Timed out getting token balances for status update');
                }
                // Compile status update
                const status = {
                    agent: {
                        id: config.agentId,
                        initialized: this.lynxifyAgent.isInitialized(),
                        network: config.hederaConfig.network
                    },
                    tokens: {
                        balances: tokenBalances
                    },
                    timestamp: Date.now()
                };
                // Broadcast to all clients
                this.broadcastToAll({
                    type: 'agent_status_update',
                    data: status
                });
            }
            catch (error) {
                console.error('❌ Error broadcasting status update:', error);
            }
        }, 10000); // Update every 10 seconds
    }
}
