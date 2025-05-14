#!/usr/bin/env node
/**
 * Complete Rebalance Flow
 * This script completes the entire rebalance flow by directly manipulating the files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// File paths for storage
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');
// Clean up any existing files
console.log('Cleaning up existing files...');
if (fs.existsSync(CONNECTIONS_FILE))
    fs.unlinkSync(CONNECTIONS_FILE);
if (fs.existsSync(PENDING_PROPOSALS_FILE))
    fs.unlinkSync(PENDING_PROPOSALS_FILE);
if (fs.existsSync(EXECUTED_PROPOSALS_FILE))
    fs.unlinkSync(EXECUTED_PROPOSALS_FILE);
async function completeFlow() {
    try {
        console.log('🔄 Starting complete rebalance flow demo');
        // Step 1: Create a test connection
        console.log('\n--- STEP 1: Create connection ---');
        const connection = {
            id: uuidv4(),
            requesterTopic: "0.0.test-topic",
            timestamp: Date.now()
        };
        fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify([connection], null, 2));
        console.log(`✅ Connection created and saved to ${CONNECTIONS_FILE}`);
        // Step 2: Create a rebalance proposal
        console.log('\n--- STEP 2: Create rebalance proposal ---');
        const proposalId = uuidv4();
        const proposal = {
            id: proposalId,
            proposal: {
                type: "RebalanceProposal",
                proposalId,
                newWeights: { "TokenA": 0.3, "TokenB": 0.7 },
                executeAfter: Date.now(),
                quorum: 5000
            },
            timestamp: Date.now()
        };
        fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify([proposal], null, 2));
        console.log(`✅ Rebalance proposal created and saved to ${PENDING_PROPOSALS_FILE}`);
        // Step 3: "Approve" the proposal (create executed proposal and remove from pending)
        console.log('\n--- STEP 3: Execute approved proposal ---');
        // Mock balances
        const preBalances = {
            'btc': 1000,
            'eth': 2000,
            'sol': 500,
            'lynx': 500
        };
        // Calculate new balances based on weights
        const totalValue = Object.values(preBalances).reduce((sum, val) => sum + val, 0);
        const postBalances = {};
        postBalances.TokenA = Math.round(totalValue * 0.3);
        postBalances.TokenB = Math.round(totalValue * 0.7);
        // Create executed proposal
        const executedProposal = {
            id: uuidv4(),
            proposalId,
            executedAt: Date.now(),
            preBalances,
            postBalances
        };
        fs.writeFileSync(EXECUTED_PROPOSALS_FILE, JSON.stringify([executedProposal], null, 2));
        console.log(`✅ Proposal execution completed and saved to ${EXECUTED_PROPOSALS_FILE}`);
        // Remove from pending
        fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify([], null, 2));
        console.log(`✅ Proposal removed from pending list`);
        // Show summary
        console.log('\n--- REBALANCE FLOW COMPLETED ---');
        console.log('📊 Data summary:');
        console.log('\nConnection:');
        console.log(JSON.stringify(connection, null, 2));
        console.log('\nOriginal Proposal:');
        console.log(JSON.stringify(proposal, null, 2));
        console.log('\nExecuted Proposal:');
        console.log(JSON.stringify(executedProposal, null, 2));
        console.log('\n✅ HCS-10 Agent Rebalance Flow completed successfully!');
        console.log('✅ Files created:');
        console.log(`   - Connections: ${CONNECTIONS_FILE}`);
        console.log(`   - Executed Proposals: ${EXECUTED_PROPOSALS_FILE}`);
        console.log(`   - Pending Proposals: ${PENDING_PROPOSALS_FILE} (now empty)`);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
completeFlow();
