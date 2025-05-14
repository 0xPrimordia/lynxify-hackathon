import { LynxifyAgent } from './lynxify-agent';
import { TokenService } from './token-service';
import { TokenizedIndexService } from './tokenized-index';
import { Server } from 'http';
/**
 * Message type for WebSocket communication
 */
export interface WebSocketMessage {
    type: string;
    data: any;
}
/**
 * UnifiedWebSocketService - Manages WebSocket connections and interfaces with LynxifyAgent
 *
 * This service provides a WebSocket interface for the unified agent architecture,
 * allowing clients to receive real-time updates and send commands to the agent.
 */
export declare class UnifiedWebSocketService {
    private wss;
    private httpServer;
    private externalServer;
    private clients;
    private eventBus;
    private lynxifyAgent;
    private tokenService;
    private indexService;
    private statusUpdateInterval;
    /**
     * Initialize WebSocket server
     * @param agent The LynxifyAgent instance
     * @param tokenService The TokenService instance
     * @param indexService The TokenizedIndexService instance
     * @param port Server port (default: 3001)
     * @param existingServer Optional existing HTTP server to attach to
     */
    constructor(agent: LynxifyAgent, tokenService: TokenService, indexService: TokenizedIndexService, port?: number, existingServer?: Server);
    /**
     * Handle new WebSocket connections
     */
    private handleConnection;
    /**
     * Handle messages from clients
     */
    private handleClientMessage;
    /**
     * Handle token operation requests
     * Note: This is lower priority compared to the agent and HCS flow
     */
    private handleTokenOperation;
    /**
     * Handle rebalance proposal requests
     */
    private handleRebalanceProposal;
    /**
     * Set up event listeners for agent events
     */
    private setupEventListeners;
    /**
     * Broadcast message to all connected clients
     */
    broadcastToAll(message: WebSocketMessage): void;
    /**
     * Send message to a specific client
     */
    private sendToClient;
    /**
     * Close the WebSocket server
     */
    close(): void;
    /**
     * Send comprehensive agent status to a client
     */
    private sendAgentStatus;
    /**
     * Start periodic status updates
     */
    private startStatusUpdates;
}
