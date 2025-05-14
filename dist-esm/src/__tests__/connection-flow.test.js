import { HCS10Agent } from '../lib/hcs10-agent';
import { v4 as uuidv4 } from 'uuid';
// Mock HCS10Client implementation
class MockHCS10Client {
    constructor() {
        this.messages = new Map();
        this.topics = new Map();
    }
    async createTopic() {
        const topicId = `0.0.${uuidv4().slice(0, 8)}`;
        this.topics.set(topicId, topicId);
        return topicId;
    }
    async sendMessage(topicId, message) {
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        this.messages.get(topicId).push(message);
        return { success: true };
    }
    async getMessageStream(topicId) {
        const messages = this.messages.get(topicId) || [];
        return {
            messages: messages.map((content, index) => ({
                sequence_number: index + 1,
                contents: content
            }))
        };
    }
    clearMessages(topicId) {
        this.messages.set(topicId, []);
    }
}
describe('HCS10Agent Connection Flow', () => {
    let agent;
    let client;
    let agentInboundTopic;
    let agentOutboundTopic;
    let clientInboundTopic;
    let clientOutboundTopic;
    beforeEach(async () => {
        client = new MockHCS10Client();
        // Create topics for agent and client
        agentInboundTopic = await client.createTopic();
        agentOutboundTopic = await client.createTopic();
        clientInboundTopic = await client.createTopic();
        clientOutboundTopic = await client.createTopic();
        // Initialize agent
        agent = new HCS10Agent(client, agentInboundTopic, agentOutboundTopic);
        agent.start(100); // Poll every 100ms for faster tests
    });
    afterEach(() => {
        agent.stop();
    });
    it('should handle connection request and create connection', async () => {
        // Simulate client sending connection request
        const connectionRequest = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${clientInboundTopic}@0.0.123`,
            timestamp: Date.now()
        };
        // Send connection request to agent's inbound topic
        await client.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest));
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 200));
        // Check if agent sent connection_created response
        const messages = await client.getMessageStream(clientInboundTopic);
        expect(messages.messages.length).toBe(1);
        const response = JSON.parse(messages.messages[0].contents);
        expect(response.p).toBe('hcs-10');
        expect(response.op).toBe('connection_created');
        expect(response.requesterId).toBe(agentOutboundTopic);
    });
    it('should handle duplicate connection requests', async () => {
        // First connection request
        const connectionRequest = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${clientInboundTopic}@0.0.123`,
            timestamp: Date.now()
        };
        // Send first request
        await client.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest));
        await new Promise(resolve => setTimeout(resolve, 200));
        // Clear messages for clean test
        client.clearMessages(clientInboundTopic);
        // Send second request
        await client.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest));
        await new Promise(resolve => setTimeout(resolve, 200));
        // Check responses
        const messages = await client.getMessageStream(clientInboundTopic);
        expect(messages.messages.length).toBe(1); // Should only have one response
        const response = JSON.parse(messages.messages[0].contents);
        expect(response.p).toBe('hcs-10');
        expect(response.op).toBe('connection_created');
    });
    it('should handle multiple different clients', async () => {
        // First client
        const client1Request = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${clientInboundTopic}@0.0.123`,
            timestamp: Date.now()
        };
        // Second client
        const client2Request = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${clientOutboundTopic}@0.0.456`,
            timestamp: Date.now()
        };
        // Send requests
        await client.sendMessage(agentInboundTopic, JSON.stringify(client1Request));
        await client.sendMessage(agentInboundTopic, JSON.stringify(client2Request));
        await new Promise(resolve => setTimeout(resolve, 200));
        // Check responses
        const client1Messages = await client.getMessageStream(clientInboundTopic);
        const client2Messages = await client.getMessageStream(clientOutboundTopic);
        expect(client1Messages.messages.length).toBe(1);
        expect(client2Messages.messages.length).toBe(1);
        const response1 = JSON.parse(client1Messages.messages[0].contents);
        const response2 = JSON.parse(client2Messages.messages[0].contents);
        expect(response1.p).toBe('hcs-10');
        expect(response1.op).toBe('connection_created');
        expect(response2.p).toBe('hcs-10');
        expect(response2.op).toBe('connection_created');
    });
});
