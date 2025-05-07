#!/usr/bin/env ts-node
/**
 * HCS-10 Agent Mock Test
 * This script simulates the agent workflow with mocked topic creation
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MockHCS10Client } from '../lib/mock-hcs10-client';
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
/**
 * Run the mock HCS-10 agent test
 */
async function runMockTest() {
    try {
        console.log('🚀 Starting HCS-10 Mock Agent Test');
        // Create our mock client
        const client = new MockHCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            operatorPrivateKey: process.env.OPERATOR_KEY || ''
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
        // Create the proposal object with proper typing
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
