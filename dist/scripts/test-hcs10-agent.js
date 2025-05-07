#!/usr/bin/env node
/**
 * HCS-10 Agent Test
 * This script simulates sending a rebalance proposal to the agent
 */
// Convert to ESM
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Check required environment variables
const requiredEnvVars = [
    'NEXT_PUBLIC_OPERATOR_ID',
    'OPERATOR_KEY'
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}
// Check registration status
const registrationStatusPath = path.join(process.cwd(), '.registration_status.json');
if (!fs.existsSync(registrationStatusPath)) {
    console.error('❌ Agent not registered. Please run registration script first.');
    process.exit(1);
}
// Read registration info
const registrationInfo = JSON.parse(fs.readFileSync(registrationStatusPath, 'utf8'));
// Display registration info
console.log('✅ Using registered agent:');
console.log(`   Account ID: ${registrationInfo.accountId}`);
console.log(`   Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
console.log(`   Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
// Test functions
async function runTests() {
    try {
        console.log('🚀 Initializing HCS10 client...');
        const client = new HCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
            operatorPrivateKey: process.env.OPERATOR_KEY,
            logLevel: 'debug'
        });
        console.log('✅ HCS10 client initialized');
        // First test: Create a connection to the agent
        console.log('\n🔄 TEST 1: Creating a connection to the agent...');
        try {
            // Create a connection topic for communication
            console.log('📝 Creating a connection topic...');
            const connectionTopicId = await client.createTopic();
            if (!connectionTopicId) {
                throw new Error('Failed to create connection topic');
            }
            console.log(`✅ Connection topic created: ${connectionTopicId}`);
            // Send a connection request message to the agent
            console.log('📝 Sending connection request message...');
            // Create the connection request message in the HCS-10 format
            const connectionRequest = {
                p: 'hcs-10',
                op: 'connection_request',
                operator_id: `${connectionTopicId}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
                timestamp: Date.now()
            };
            // Send the connection request to the agent's inbound topic
            await client.sendMessage(registrationInfo.inboundTopicId, JSON.stringify(connectionRequest));
            console.log('✅ Connection request sent to agent');
            // Wait for the agent to process the connection request
            console.log('⏱️  Waiting for connection confirmation...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Check if the agent responded on our connection topic
            const messages = await client.getMessageStream(connectionTopicId);
            let connectionConfirmed = false;
            for (const message of messages.messages) {
                try {
                    const content = JSON.parse(message.content || message.contents);
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
                console.log('⚠️ Connection not confirmed yet. Proceeding anyway...');
            }
            // Second test: Send a rebalance proposal
            console.log('\n🔄 TEST 2: Sending rebalance proposal...');
            // Create a rebalance proposal message
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
            const hcs10Message = {
                p: 'hcs-10',
                op: 'message',
                data: JSON.stringify(proposal)
            };
            // Send the message
            await client.sendMessage(connectionTopicId, JSON.stringify(hcs10Message));
            console.log('✅ Rebalance proposal sent');
            // Wait a bit to let the agent process the proposal
            console.log('⏱️  Waiting for agent to process the proposal...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Third test: Send a rebalance approval
            console.log('\n🔄 TEST 3: Sending rebalance approval...');
            // Create a rebalance approval message
            const approval = {
                type: 'RebalanceApproved',
                proposalId: proposalId,
                timestamp: Date.now()
            };
            // Create the HCS-10 formatted message
            const approvalMessage = {
                p: 'hcs-10',
                op: 'message',
                data: JSON.stringify(approval)
            };
            // Send the message
            await client.sendMessage(connectionTopicId, JSON.stringify(approvalMessage));
            console.log('✅ Rebalance approval sent');
            // Wait for execution
            console.log('⏱️  Waiting for agent to execute the proposal...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Check for messages on the agent's outbound topic
            console.log('\n🔄 TEST 4: Checking for execution results...');
            const messagesResult = await client.getMessageStream(registrationInfo.outboundTopicId);
            let foundExecutionResult = false;
            for (const message of messagesResult.messages) {
                try {
                    const content = JSON.parse(message.content || message.contents);
                    if (content.type === 'RebalanceExecuted' && content.proposalId === proposalId) {
                        console.log('✅ Found execution result:');
                        console.log('   Pre-balances:', JSON.stringify(content.preBalances));
                        console.log('   Post-balances:', JSON.stringify(content.postBalances));
                        console.log('   Executed at:', new Date(content.executedAt).toISOString());
                        foundExecutionResult = true;
                        break;
                    }
                }
                catch (e) {
                    // Skip message parsing errors
                }
            }
            if (!foundExecutionResult) {
                console.log('❓ No execution result found yet. The agent might still be processing.');
            }
            // Fourth test: Query index composition
            console.log('\n🔄 TEST 5: Querying index composition...');
            // Create a query message
            const query = {
                type: 'QueryIndexComposition',
                timestamp: Date.now()
            };
            // Create the HCS-10 formatted message
            const queryMessage = {
                p: 'hcs-10',
                op: 'message',
                data: JSON.stringify(query)
            };
            // Send the message
            await client.sendMessage(connectionTopicId, JSON.stringify(queryMessage));
            console.log('✅ Index composition query sent');
            // Wait for response
            console.log('⏱️  Waiting for agent response...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Check for response on the connection topic
            const connectionMessages = await client.getMessageStream(connectionTopicId);
            let foundCompositionResponse = false;
            for (const message of connectionMessages.messages) {
                try {
                    const content = JSON.parse(message.content || message.contents);
                    if (content.op === 'message') {
                        const data = JSON.parse(content.data);
                        if (data.type === 'IndexComposition') {
                            console.log('✅ Found index composition response:');
                            console.log('   Composition:', JSON.stringify(data.composition));
                            foundCompositionResponse = true;
                            break;
                        }
                    }
                }
                catch (e) {
                    // Skip message parsing errors
                }
            }
            if (!foundCompositionResponse) {
                console.log('❓ No composition response found yet. The agent might still be processing.');
            }
            // Close the connection
            console.log('\n🔄 TEST 6: Closing connection...');
            // Create the close connection message
            const closeMessage = {
                p: 'hcs-10',
                op: 'close_connection',
                reason: 'Test completed'
            };
            // Send the message
            await client.sendMessage(connectionTopicId, JSON.stringify(closeMessage));
            console.log('✅ Connection close request sent');
            console.log('\n✅ All tests completed');
        }
        catch (error) {
            console.error('❌ Error during connection test:', error);
        }
    }
    catch (error) {
        console.error('❌ Error initializing client:', error);
    }
}
// Run the tests
console.log('🧪 Starting HCS-10 agent tests...');
runTests().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
