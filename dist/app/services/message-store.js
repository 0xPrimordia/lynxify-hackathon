"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Global in-memory store for HCS messages (for demo purposes)
class MessageStore {
    constructor() {
        this.messages = new Map();
        this.messageIds = new Set(); // Track message IDs to prevent duplicates
        console.log('🔄 MESSAGE STORE: Creating global message store');
    }
    static getInstance() {
        if (!MessageStore.instance) {
            MessageStore.instance = new MessageStore();
        }
        return MessageStore.instance;
    }
    addMessage(topicId, message) {
        // Skip if message ID already exists
        if (this.messageIds.has(message.id)) {
            console.log(`⚠️ MESSAGE STORE: Skipping duplicate message ID ${message.id}`);
            return;
        }
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        const topicMessages = this.messages.get(topicId);
        topicMessages.push(message);
        this.messageIds.add(message.id);
        console.log(`✅ MESSAGE STORE: Added message to topic ${topicId}, total: ${topicMessages.length}`);
        console.log(`✅ MESSAGE STORE: Message details: type=${message.type}, id=${message.id}`);
    }
    getMessages(topicId) {
        const messages = this.messages.get(topicId) || [];
        console.log(`✅ MESSAGE STORE: Retrieved ${messages.length} messages for topic ${topicId}`);
        return messages;
    }
    getAllMessages() {
        let allMessages = [];
        this.messages.forEach((messages, topicId) => {
            console.log(`✅ MESSAGE STORE: Topic ${topicId} has ${messages.length} messages`);
            allMessages = allMessages.concat(messages);
        });
        allMessages.sort((a, b) => b.timestamp - a.timestamp);
        console.log(`✅ MESSAGE STORE: Retrieved ${allMessages.length} total messages (${this.messageIds.size} unique IDs)`);
        return allMessages;
    }
    clearMessages() {
        this.messages.clear();
        this.messageIds.clear();
        console.log('🧹 MESSAGE STORE: Cleared all messages');
    }
}
// Global singleton instance
const messageStore = MessageStore.getInstance();
exports.default = messageStore;
