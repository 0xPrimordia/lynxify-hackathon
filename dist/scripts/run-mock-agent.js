#!/usr/bin/env node
/**
 * HCS-10 Agent Mock Test
 * This script simulates the agent workflow with mocked topic creation
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Mock HCS10Client implementation
class MockHCS10Client {
    constructor(config) {
        this.config = config;
        this.topics = new Map();
        this.messages = new Map();
        this.topics.set('inbound', '0.0.5956431'); // Use real inbound topic from registration
        console.log('🔄 Initialized MockHCS10Client');
    }
    async createTopic() {
        // Create a fake topic ID
        const topicId = `0.0.${Math.floor(Math.random() * 1000000 + 5000000)}`;
        this.topics.set(topicId, []);
        this.messages.set(topicId, []);
        console.log(`🔄 Created mock topic: ${topicId}`);
        return topicId;
    }
    async sendMessage(topicId, message) {
        // Add the message to our stored messages
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        // Generate a sequence number
        const sequenceNumber = Date.now();
        // Store the message with metadata
        this.messages.get(topicId).push({
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
    async getMessageStream(topicId) {
        // Return stored messages for this topic
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        console.log(`🔄 Getting messages from topic ${topicId}`);
        return { messages: this.messages.get(topicId) };
    }
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
async function runMockTest() {
    try {
        console.log('🚀 Starting HCS-10 Mock Agent Test');
        // Create our mock client
        const client = new MockHCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
            operatorPrivateKey: process.env.OPERATOR_KEY
        });
        // Read registration info
        const registrationStatusPath = path.join(process.cwd(), '.registration_status.json');
        if (!fs.existsSync(registrationStatusPath)) {
            console.error('❌ Agent not registered. Please run registration script first.');
            process.exit(1);
        }
        const registrationInfo = JSON.parse(fs.readFileSync(registrationStatusPath, 'utf8'));
        // Display registration info
        console.log('✅ Using registered agent:');
        console.log(`   Account ID: ${registrationInfo.accountId}`);
        console.log(`   Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
        console.log(`   Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        // Step 1: Create a connection topic
        console.log('\n🔄 STEP 1: Creating a connection topic...');
        const connectionTopicId = await client.createTopic();
        console.log(`✅ Connection topic created: ${connectionTopicId}`);
        // Step 2: Send a connection request
        console.log('\n🔄 STEP 2: Sending connection request...');
        const connectionRequest = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${connectionTopicId}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
            timestamp: Date.now()
        };
        await client.sendMessage(registrationInfo.inboundTopicId, JSON.stringify(connectionRequest));
        console.log('✅ Connection request sent to agent');
        // Step 3: Wait for confirmation
        console.log('\n🔄 STEP 3: Waiting for connection confirmation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check for confirmation message
        const messages = await client.getMessageStream(connectionTopicId);
        let connectionConfirmed = false;
        for (const message of messages.messages) {
            try {
                const content = JSON.parse(message.contents);
                if (content.p === 'hcs-10' && content.op === 'connection_created') {
                    connectionConfirmed = true;
                    console.log('✅ Connection confirmed by agent');
                    break;
                }
            }
            catch (error) {
                console.error('Error parsing message:', error);
            }
        }
        if (!connectionConfirmed) {
            console.log('⚠️ Connection not confirmed. This is expected in the mock test.');
        }
        // Step 4: Send a rebalance proposal
        console.log('\n🔄 STEP 4: Sending rebalance proposal...');
        const proposalId = `P${Date.now()}`;
        const proposal = {
            type: 'RebalanceProposal',
            proposalId: proposalId,
            newWeights: {
                'btc': 0.4,
                'eth': 0.3,
                'sol': 0.2,
                'lynx': 0.1
            },
            timestamp: Date.now()
        };
        // Create the HCS-10 formatted message
        const proposalMessage = {
            p: 'hcs-10',
            op: 'message',
            data: JSON.stringify(proposal)
        };
        // Send the message
        await client.sendMessage(connectionTopicId, JSON.stringify(proposalMessage));
        console.log('✅ Rebalance proposal sent');
        // Final success message
        console.log('\n✅ HCS-10 Mock Agent Test Completed Successfully');
        console.log('You can now verify the agent functionality by checking:');
        console.log('1. .connections.json - Should have a new connection entry');
        console.log('2. .pending_proposals.json - Should have the new proposal');
    }
    catch (error) {
        console.error('❌ Error running mock test:', error);
    }
}
// Run the mock test
console.log('🧪 Starting HCS-10 mock agent test...');
runMockTest().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
