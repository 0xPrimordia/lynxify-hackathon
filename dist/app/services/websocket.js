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
        this.receivedMessageCount = 0;
        console.log('🔌 WEBSOCKET: Initializing WebSocket service');
        this.connect();
    }
    connect() {
        try {
            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
            console.log(`🔌 WEBSOCKET: Connecting to ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => {
                console.log('🔌 WEBSOCKET: Connected successfully');
                this.reconnectAttempts = 0;
            };
            this.ws.onmessage = (event) => {
                try {
                    this.receivedMessageCount++;
                    console.log(`🔌 WEBSOCKET: Message #${this.receivedMessageCount} received:`, event.data.substring(0, 100) + '...');
                    const parsedData = JSON.parse(event.data);
                    // Check the message structure - agent sends messages with type and data fields
                    if (parsedData.type && parsedData.data) {
                        console.log('🔌 WEBSOCKET: Processing message with format:', parsedData.type);
                        // Extract the HCS message from the data field
                        const message = parsedData.data;
                        console.log(`🔌 WEBSOCKET: Extracted HCS message of type: ${message.type}, id: ${message.id}`);
                        this.messageCallbacks.forEach(callback => {
                            console.log(`🔌 WEBSOCKET: Calling callback for message id: ${message.id}`);
                            callback(message);
                        });
                    }
                    else if (parsedData.type === 'system') {
                        // System message, just log it
                        console.log('🔌 WEBSOCKET: System message:', parsedData.data?.message);
                    }
                    else {
                        // Try to process as a direct HCS message
                        console.log('🔌 WEBSOCKET: Attempting to process as direct HCS message');
                        const message = parsedData;
                        console.log(`🔌 WEBSOCKET: Direct HCS message of type: ${message.type}, id: ${message.id}`);
                        this.messageCallbacks.forEach(callback => {
                            console.log(`🔌 WEBSOCKET: Calling callback for direct message id: ${message.id}`);
                            callback(message);
                        });
                    }
                }
                catch (error) {
                    console.error('🔌 WEBSOCKET ERROR: Error parsing WebSocket message:', error);
                }
            };
            this.ws.onclose = () => {
                console.log('🔌 WEBSOCKET: Disconnected');
                this.attemptReconnect();
            };
            this.ws.onerror = (error) => {
                console.error('🔌 WEBSOCKET ERROR:', error);
            };
        }
        catch (error) {
            console.error('🔌 WEBSOCKET ERROR: Error connecting to WebSocket:', error);
            this.attemptReconnect();
        }
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('🔌 WEBSOCKET: Max reconnection attempts reached');
            return;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`🔌 WEBSOCKET: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)); // Exponential backoff
    }
    subscribe(callback) {
        console.log(`🔌 WEBSOCKET: Adding subscription, total subscribers: ${this.messageCallbacks.length + 1}`);
        this.messageCallbacks.push(callback);
        return () => {
            console.log('🔌 WEBSOCKET: Removing subscription');
            this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
        };
    }
    disconnect() {
        if (this.ws) {
            console.log('🔌 WEBSOCKET: Closing connection');
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
