import { HCSMessage } from '../types/hcs';
type BroadcastMessage = {
    type: string;
    data: any;
};
type MessageCallback = (message: HCSMessage) => void;
/**
 * WebSocketService - Manages WebSocket connections and broadcasting
 */
export declare class WebSocketService {
    private wss;
    private clients;
    private subscribers;
    /**
     * Initialize WebSocket server
     * @param port Server port (default: 3001)
     */
    constructor(port?: number);
    /**
     * Broadcast message to all connected clients
     * @param message Message to broadcast
     */
    broadcast(message: BroadcastMessage): void;
    /**
     * Subscribe to HCS messages
     * @param callback Function to call when new messages arrive
     * @returns Function to unsubscribe
     */
    subscribe(callback: MessageCallback): () => void;
    /**
     * Notify all subscribers of a new message
     * @param message HCS message to notify about
     */
    private notifySubscribers;
    /**
     * Send message to a specific client
     * @param client WebSocket client
     * @param message Message to send
     */
    private sendToClient;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Close the WebSocket server
     */
    close(): void;
}
declare const _default: WebSocketService;
export default _default;
