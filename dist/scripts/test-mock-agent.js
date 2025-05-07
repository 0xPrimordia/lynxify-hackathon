#!/usr/bin/env node
/**
 * Mock Test for HCS-10 Agent
 * This script tests our HCS-10 agent using the mock client
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
// Import our mock client
import { MockHCS10Client } from '../dist/src/lib/mock-hcs10-client.js';
// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });
// Constants
const REGISTRATION_FILE = join(process.cwd(), '.registration_status.json');
// Log with timestamp
function log(message) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${message}`);
}
// Main function
async function main() {
    try {
        log('🚀 Starting HCS-10 Agent Mock Test');
        // Check registration
        if (!fs.existsSync(REGISTRATION_FILE)) {
            log('❌ Agent not registered. Please run registration script first.');
            process.exit(1);
        }
        // Load registration info
        const registrationInfo = JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8'));
        log('✅ Using registered agent:');
        log(`   Account ID: ${registrationInfo.accountId}`);
        log(`   Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
        log(`   Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        // Create mock client
        const client = new MockHCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            operatorPrivateKey: process.env.OPERATOR_KEY || ''
        });
        log('✅ Mock HCS10 client created');
        // Step 1: Create a connection topic
        log('\n🔄 STEP 1: Creating a connection topic...');
        const connectionTopicId = await client.createTopic();
        log(`✅ Connection topic created: ${connectionTopicId}`);
        // Step 2: Send a connection request
        log('\n🔄 STEP 2: Sending connection request...');
        const connectionRequest = {
            p: 'hcs-10',
            op: 'connection_request',
            operator_id: `${connectionTopicId}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
            timestamp: Date.now()
        };
        await client.sendMessage(registrationInfo.inboundTopicId, JSON.stringify(connectionRequest));
        log('✅ Connection request sent to agent');
        // Wait for connections to be established
        log('⏳ Waiting for connection to be established...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Check connection file
        log('\n🔄 STEP 3: Checking for established connection...');
        const connectionsPath = join(process.cwd(), '.connections.json');
        if (fs.existsSync(connectionsPath)) {
            try {
                const connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
                log(`✅ Found ${connections.length} connection(s)`);
                // Filter connections to see if our test connection is in there
                const ourConnection = connections.find(c => c.requesterTopic === connectionTopicId);
                if (ourConnection) {
                    log('✅ Test connection successfully established!');
                }
                else {
                    log('⚠️ Test connection not found in connections list.');
                }
            }
            catch (error) {
                log(`❌ Error reading connections file: ${error.message}`);
            }
        }
        else {
            log('❌ No connections file found. The agent may not be running.');
        }
        // Step 4: Send a rebalance proposal
        log('\n🔄 STEP 4: Sending rebalance proposal...');
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
        log('✅ Rebalance proposal sent');
        // Wait for proposal to be processed
        log('⏳ Waiting for proposal to be processed...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Check pending proposals file
        log('\n🔄 STEP 5: Checking for pending proposal...');
        const pendingProposalsPath = join(process.cwd(), '.pending_proposals.json');
        if (fs.existsSync(pendingProposalsPath)) {
            try {
                const proposals = JSON.parse(fs.readFileSync(pendingProposalsPath, 'utf8'));
                log(`✅ Found ${proposals.length} pending proposal(s)`);
                // Filter proposals to see if our test proposal is in there
                const ourProposal = proposals.find(p => p.id === proposalId);
                if (ourProposal) {
                    log('✅ Test proposal successfully stored!');
                }
                else {
                    log('⚠️ Test proposal not found in pending proposals list.');
                }
            }
            catch (error) {
                log(`❌ Error reading pending proposals file: ${error.message}`);
            }
        }
        else {
            log('❌ No pending proposals file found. The agent may not be processing proposals.');
        }
        // Step 6: Send a rebalance approval
        log('\n🔄 STEP 6: Sending rebalance approval...');
        const approval = {
            type: 'RebalanceApproved',
            proposalId: proposalId,
            approvedAt: Date.now(),
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
        log('✅ Rebalance approval sent');
        // Wait for execution
        log('⏳ Waiting for proposal to be executed...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        // Final status check
        log('\n📊 HCS-10 Agent Test Summary:');
        // Check connections again
        let connectionCount = 0;
        if (fs.existsSync(connectionsPath)) {
            try {
                const connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
                connectionCount = connections.length;
            }
            catch (error) {
                // Ignore
            }
        }
        // Check pending proposals
        let pendingCount = 0;
        if (fs.existsSync(pendingProposalsPath)) {
            try {
                const proposals = JSON.parse(fs.readFileSync(pendingProposalsPath, 'utf8'));
                pendingCount = proposals.length;
            }
            catch (error) {
                // Ignore
            }
        }
        // Check for executed proposals file
        const executedProposalsPath = join(process.cwd(), '.executed_proposals.json');
        let executedCount = 0;
        if (fs.existsSync(executedProposalsPath)) {
            try {
                const executed = JSON.parse(fs.readFileSync(executedProposalsPath, 'utf8'));
                executedCount = executed.length;
            }
            catch (error) {
                // Ignore
            }
        }
        log(`  Connections: ${connectionCount}`);
        log(`  Pending Proposals: ${pendingCount}`);
        log(`  Executed Proposals: ${executedCount}`);
        log('\n✅ Test completed successfully!');
    }
    catch (error) {
        log(`❌ Error in test: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}
// Run the test
main();
