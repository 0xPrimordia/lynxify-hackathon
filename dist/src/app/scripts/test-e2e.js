/**
 * End-to-end test script for Lynxify Server
 *
 * This script:
 * 1. Initializes the refactored server
 * 2. Simulates Moonscape agent registration
 * 3. Sends a test proposal message
 * 4. Verifies the proposal is processed correctly
 * 5. Shuts down gracefully
 */
// Import server components
import { initializeServer } from '../server/server-init';
import { HederaService } from '../services/hedera';
import agentRegistry from '../services/agent-registry';
import websocketService from '../services/websocket';
import { getAllTopicIds, getOptionalEnv } from '../utils/env-utils';
// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import '../config/env';
async function runE2ETest() {
    console.log('🧪 Starting E2E Test...');
    try {
        // 1. Initialize the server
        console.log('🧪 Initializing server...');
        await initializeServer();
        console.log('✅ Server initialized successfully');
        // 2. Check agent registration (was done during initialization)
        const operatorId = getOptionalEnv('NEXT_PUBLIC_OPERATOR_ID');
        const registrationInfo = await agentRegistry.getStoredRegistrationInfo();
        if (registrationInfo) {
            console.log('✅ Agent registration verified:');
            console.log(`   - Account ID: ${registrationInfo.accountId}`);
            console.log(`   - Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
            console.log(`   - Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        }
        else {
            console.log('❌ Agent registration not found');
        }
        // 3. Get topic IDs
        const { governanceTopic, agentTopic, inboundTopic, } = getAllTopicIds();
        // 4. Create Hedera service for publishing test messages
        const hederaService = new HederaService();
        // 5. Create a test proposal message
        const proposalMessage = {
            id: `e2e-test-proposal-${Date.now()}`,
            type: 'RebalanceProposal',
            timestamp: Date.now(),
            sender: 'e2e-test',
            details: {
                newWeights: { BTC: 0.4, ETH: 0.4, SOL: 0.2 },
                executeAfter: Date.now() + 86400000,
                quorum: 5000,
                trigger: 'scheduled',
                message: "E2E test rebalance proposal"
            }
        };
        // 6. Set up a promise to resolve when the proposal is executed
        let proposalExecuted = false;
        let approvalReceived = false;
        const executionPromise = new Promise((resolve, reject) => {
            // Listen for messages on agent topic
            hederaService.subscribeToTopic(agentTopic, (message) => {
                if (message.type === 'RebalanceExecuted' &&
                    message.details?.proposalId === proposalMessage.id) {
                    proposalExecuted = true;
                    console.log('✅ Proposal execution detected on agent topic');
                    resolve();
                }
            });
            // Also listen for approvals on governance topic
            hederaService.subscribeToTopic(governanceTopic, (message) => {
                if (message.type === 'RebalanceApproved' &&
                    message.details?.proposalId === proposalMessage.id) {
                    approvalReceived = true;
                    console.log('✅ Proposal approval detected on governance topic');
                }
            });
            // Set timeout in case execution doesn't happen
            setTimeout(() => {
                if (!proposalExecuted) {
                    reject(new Error('Timeout waiting for proposal execution'));
                }
            }, 10000); // 10 second timeout
        });
        // 7. Publish the test proposal
        console.log('🧪 Publishing test proposal...');
        await hederaService.publishHCSMessage(governanceTopic, proposalMessage);
        console.log('✅ Test proposal published to governance topic');
        // 8. Wait for execution to complete
        console.log('🧪 Waiting for proposal to be processed...');
        await executionPromise;
        if (proposalExecuted) {
            console.log('✅ E2E TEST PASSED: Proposal was successfully executed');
            console.log(`   - Proposal ID: ${proposalMessage.id}`);
            console.log(`   - Approval received: ${approvalReceived ? 'Yes' : 'No'}`);
            console.log(`   - Execution detected: ${proposalExecuted ? 'Yes' : 'No'}`);
        }
        else {
            console.log('❌ E2E TEST FAILED: Proposal was not executed');
        }
    }
    catch (error) {
        console.error('❌ E2E TEST ERROR:', error);
    }
    finally {
        // 9. Clean up and shutdown
        console.log('🧪 Cleaning up and shutting down...');
        websocketService.close();
        console.log('✅ WebSocket server closed');
        // Exit with success code
        process.exit(0);
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Test interrupted, shutting down...');
    websocketService.close();
    process.exit(1);
});
// Run the test
runE2ETest().catch(err => {
    console.error('❌ FATAL E2E TEST ERROR:', err);
    process.exit(1);
});
