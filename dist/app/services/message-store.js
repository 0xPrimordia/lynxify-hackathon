"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Global in-memory store for HCS messages (for demo purposes)
var MessageStore = /** @class */ (function () {
    function MessageStore() {
        this.messages = new Map();
        this.messageIds = new Set(); // Track message IDs to prevent duplicates
        console.log('🔄 MESSAGE STORE: Creating global message store');
    }
    MessageStore.getInstance = function () {
        if (!MessageStore.instance) {
            MessageStore.instance = new MessageStore();
        }
        return MessageStore.instance;
    };
    MessageStore.prototype.addMessage = function (topicId, message) {
        // Skip if message ID already exists
        if (this.messageIds.has(message.id)) {
            console.log("\u26A0\uFE0F MESSAGE STORE: Skipping duplicate message ID ".concat(message.id));
            return;
        }
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        var topicMessages = this.messages.get(topicId);
        topicMessages.push(message);
        this.messageIds.add(message.id);
        console.log("\u2705 MESSAGE STORE: Added message to topic ".concat(topicId, ", total: ").concat(topicMessages.length));
        console.log("\u2705 MESSAGE STORE: Message details: type=".concat(message.type, ", id=").concat(message.id));
    };
    MessageStore.prototype.getMessages = function (topicId) {
        var messages = this.messages.get(topicId) || [];
        console.log("\u2705 MESSAGE STORE: Retrieved ".concat(messages.length, " messages for topic ").concat(topicId));
        return messages;
    };
    MessageStore.prototype.getAllMessages = function () {
        var allMessages = [];
        this.messages.forEach(function (messages, topicId) {
            console.log("\u2705 MESSAGE STORE: Topic ".concat(topicId, " has ").concat(messages.length, " messages"));
            allMessages = allMessages.concat(messages);
        });
        allMessages.sort(function (a, b) { return b.timestamp - a.timestamp; });
        console.log("\u2705 MESSAGE STORE: Retrieved ".concat(allMessages.length, " total messages (").concat(this.messageIds.size, " unique IDs)"));
        return allMessages;
    };
    MessageStore.prototype.clearMessages = function () {
        this.messages.clear();
        this.messageIds.clear();
        console.log('🧹 MESSAGE STORE: Cleared all messages');
    };
    return MessageStore;
}());
// Global singleton instance
var messageStore = MessageStore.getInstance();
exports.default = messageStore;
