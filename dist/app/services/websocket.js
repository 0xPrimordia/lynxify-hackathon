"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = void 0;
var WebSocketService = /** @class */ (function () {
    function WebSocketService() {
        this.ws = null;
        this.messageCallbacks = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.receivedMessageCount = 0;
        console.log('🔌 WEBSOCKET: Initializing WebSocket service');
        this.connect();
    }
    WebSocketService.prototype.connect = function () {
        var _this = this;
        try {
            var wsUrl_1 = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
            // Add detailed debug logging for the WebSocket URL
            console.log("\uD83D\uDD0C WEBSOCKET DEBUG: Attempting connection with URL: ".concat(wsUrl_1));
            console.log("\uD83D\uDD0C WEBSOCKET DEBUG: URL Protocol: ".concat(new URL(wsUrl_1).protocol));
            console.log("\uD83D\uDD0C WEBSOCKET DEBUG: URL Host: ".concat(new URL(wsUrl_1).host));
            console.log("\uD83D\uDD0C WEBSOCKET DEBUG: Environment value NEXT_PUBLIC_WS_URL = \"".concat(process.env.NEXT_PUBLIC_WS_URL, "\""));
            console.log("\uD83D\uDD0C WEBSOCKET: Connecting to ".concat(wsUrl_1));
            this.ws = new WebSocket(wsUrl_1);
            this.ws.onopen = function () {
                console.log('🔌 WEBSOCKET: Connected successfully');
                console.log("\uD83D\uDD0C WEBSOCKET DEBUG: Successfully connected to ".concat(wsUrl_1));
                _this.reconnectAttempts = 0;
            };
            this.ws.onmessage = function (event) {
                var _a;
                try {
                    _this.receivedMessageCount++;
                    console.log("\uD83D\uDD0C WEBSOCKET: Message #".concat(_this.receivedMessageCount, " received:"), event.data.substring(0, 100) + '...');
                    var parsedData = JSON.parse(event.data);
                    // Check the message structure - agent sends messages with type and data fields
                    if (parsedData.type && parsedData.data) {
                        console.log('🔌 WEBSOCKET: Processing message with format:', parsedData.type);
                        // Extract the HCS message from the data field
                        var message_1 = parsedData.data;
                        console.log("\uD83D\uDD0C WEBSOCKET: Extracted HCS message of type: ".concat(message_1.type, ", id: ").concat(message_1.id));
                        _this.messageCallbacks.forEach(function (callback) {
                            console.log("\uD83D\uDD0C WEBSOCKET: Calling callback for message id: ".concat(message_1.id));
                            callback(message_1);
                        });
                    }
                    else if (parsedData.type === 'system') {
                        // System message, just log it
                        console.log('🔌 WEBSOCKET: System message:', (_a = parsedData.data) === null || _a === void 0 ? void 0 : _a.message);
                    }
                    else {
                        // Try to process as a direct HCS message
                        console.log('🔌 WEBSOCKET: Attempting to process as direct HCS message');
                        var message_2 = parsedData;
                        console.log("\uD83D\uDD0C WEBSOCKET: Direct HCS message of type: ".concat(message_2.type, ", id: ").concat(message_2.id));
                        _this.messageCallbacks.forEach(function (callback) {
                            console.log("\uD83D\uDD0C WEBSOCKET: Calling callback for direct message id: ".concat(message_2.id));
                            callback(message_2);
                        });
                    }
                }
                catch (error) {
                    console.error('🔌 WEBSOCKET ERROR: Error parsing WebSocket message:', error);
                    console.error('🔌 WEBSOCKET ERROR: Raw message data:', typeof event.data === 'string' ? event.data.substring(0, 200) + '...' : '[non-string data]');
                }
            };
            this.ws.onclose = function (event) {
                console.log("\uD83D\uDD0C WEBSOCKET DEBUG: Connection closed with code: ".concat(event.code, ", reason: ").concat(event.reason || 'No reason provided', ", clean: ").concat(event.wasClean));
                console.log('🔌 WEBSOCKET: Disconnected');
                _this.attemptReconnect();
            };
            this.ws.onerror = function (error) {
                console.error('🔌 WEBSOCKET ERROR:', error);
                // Try to extract more details about the error
                console.error("\uD83D\uDD0C WEBSOCKET DEBUG ERROR: ".concat(JSON.stringify(error)));
            };
        }
        catch (error) {
            console.error('🔌 WEBSOCKET ERROR: Error connecting to WebSocket:', error);
            console.error("\uD83D\uDD0C WEBSOCKET DEBUG CONNECT ERROR: ".concat(JSON.stringify(error)));
            this.attemptReconnect();
        }
    };
    WebSocketService.prototype.attemptReconnect = function () {
        var _this = this;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('🔌 WEBSOCKET: Max reconnection attempts reached');
            return;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(function () {
            _this.reconnectAttempts++;
            console.log("\uD83D\uDD0C WEBSOCKET: Attempting to reconnect (".concat(_this.reconnectAttempts, "/").concat(_this.maxReconnectAttempts, ")..."));
            _this.connect();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)); // Exponential backoff
    };
    WebSocketService.prototype.subscribe = function (callback) {
        var _this = this;
        console.log("\uD83D\uDD0C WEBSOCKET: Adding subscription, total subscribers: ".concat(this.messageCallbacks.length + 1));
        this.messageCallbacks.push(callback);
        return function () {
            console.log('🔌 WEBSOCKET: Removing subscription');
            _this.messageCallbacks = _this.messageCallbacks.filter(function (cb) { return cb !== callback; });
        };
    };
    WebSocketService.prototype.disconnect = function () {
        if (this.ws) {
            console.log('🔌 WEBSOCKET: Closing connection');
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    };
    return WebSocketService;
}());
// Create a singleton instance
exports.websocketService = new WebSocketService();
