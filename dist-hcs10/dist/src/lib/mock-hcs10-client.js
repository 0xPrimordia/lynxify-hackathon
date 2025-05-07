/**
 * Mock implementation of HCS10Client for testing purposes
 * Simulates the behavior of the SDK without actual Hedera network calls
 */
export class MockHCS10Client {
    constructor(config) {
        this.config = config;
        this.topics = new Map();
        this.messages = new Map();
        this.topics.set('inbound', '0.0.5956431'); // Use real inbound topic from registration
        console.log('🔄 Initialized MockHCS10Client');
    }
    /**
     * Creates a mock topic and returns its ID
     */
    async createTopic() {
        // Create a fake topic ID
        const topicId = `0.0.${Math.floor(Math.random() * 1000000 + 5000000)}`;
        this.topics.set(topicId, []);
        this.messages.set(topicId, []);
        console.log(`🔄 Created mock topic: ${topicId}`);
        return topicId;
    }
    /**
     * Sends a message to a topic
     * @param topicId The topic ID to send the message to
     * @param message The message content
     */
    async sendMessage(topicId, message) {
        // Add the message to our stored messages
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        // Generate a sequence number
        const sequenceNumber = Date.now();
        // Store the message with metadata
        this.messages.get(topicId)?.push({
            contents: message,
            sequence_number: sequenceNumber,
            timestamp: new Date().toISOString(),
            topic_id: topicId
        });
        console.log(`🔄 Sent message to topic ${topicId}`);
        // If this is a connection request, auto-respond
        try {
            const content = JSON.parse(message);
            if (content.p === 'hcs-10' && content.op === 'connection_request') {
                // Auto-respond on the requester's topic
                const parts = content.operator_id.split('@');
                if (parts.length === 2) {
                    const requesterTopic = parts[0];
                    setTimeout(() => {
                        this.autoRespondToConnectionRequest(requesterTopic, content);
                    }, 1000);
                }
            }
        }
        catch (error) {
            // Not a JSON message or not a connection request
        }
        return { success: true };
    }
    /**
     * Gets messages from a topic
     * @param topicId The topic ID to get messages from
     */
    async getMessageStream(topicId) {
        // Return stored messages for this topic
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        console.log(`🔄 Getting messages from topic ${topicId}`);
        return { messages: this.messages.get(topicId) || [] };
    }
    /**
     * Auto-responds to a connection request
     * @param requesterTopic The topic ID to respond to
     * @param requestMessage The original request message
     */
    async autoRespondToConnectionRequest(requesterTopic, requestMessage) {
        // Create a connection response
        const response = {
            p: 'hcs-10',
            op: 'connection_created',
            requesterId: this.config.operatorId,
            timestamp: Date.now()
        };
        // Send it to the requester's topic
        await this.sendMessage(requesterTopic, JSON.stringify(response));
        console.log(`🔄 Auto-responded to connection request on topic ${requesterTopic}`);
    }
}
