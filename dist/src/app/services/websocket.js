import { WebSocketServer, WebSocket } from 'ws';
/**
 * WebSocketService - Manages WebSocket connections and broadcasting
 */
export class WebSocketService {
    /**
     * Initialize WebSocket server
     * @param port Server port (default: 3001)
     */
    constructor(port = 3001) {
        this.clients = new Set();
        this.wss = new WebSocketServer({ port });
        // Handle connections
        this.wss.on('connection', (ws) => {
            console.log('🔌 WEBSOCKET: Client connected');
            this.clients.add(ws);
            // Send welcome message
            this.sendToClient(ws, {
                type: 'system',
                data: {
                    message: 'Connected to HCS Message Feed'
                }
            });
            // Handle disconnection
            ws.on('close', () => {
                console.log('🔌 WEBSOCKET: Client disconnected');
                this.clients.delete(ws);
            });
        });
        console.log(`🔌 WEBSOCKET: Server started on port ${port}`);
    }
    /**
     * Broadcast message to all connected clients
     * @param message Message to broadcast
     */
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        console.log(`🔌 WEBSOCKET: Broadcasting: ${messageStr.substring(0, 100)}...`);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                }
                catch (err) {
                    console.error('❌ WEBSOCKET: Error sending message:', err);
                }
            }
        });
    }
    /**
     * Send message to a specific client
     * @param client WebSocket client
     * @param message Message to send
     */
    sendToClient(client, message) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
            }
            catch (err) {
                console.error('❌ WEBSOCKET: Error sending message to client:', err);
            }
        }
    }
    /**
     * Get the number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Close the WebSocket server
     */
    close() {
        this.wss.close();
        console.log('🔌 WEBSOCKET: Server closed');
    }
}
// Export singleton instance
export default new WebSocketService();
