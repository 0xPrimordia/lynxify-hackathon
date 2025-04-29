"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = void 0;
class WebSocketService {
    constructor() {
        this.ws = null;
        this.messageCallbacks = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.connect();
    }
    connect() {
        try {
            // Connect to the WebSocket server (we'll need to implement this)
            this.ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
            };
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.messageCallbacks.forEach(callback => callback(message));
                }
                catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.attemptReconnect();
            };
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.attemptReconnect();
        }
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)); // Exponential backoff
    }
    subscribe(callback) {
        this.messageCallbacks.push(callback);
        return () => {
            this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
        };
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
}
// Create a singleton instance
exports.websocketService = new WebSocketService();
