#!/usr/bin/env node

/**
 * Send Rebalance Approval
 * This script sends a rebalance approval message directly to the agent
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import the mock client
import { MockHCS10Client } from '../dist-hcs10/src/lib/mock-hcs10-client.js';

// File paths for storage
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');
const REGISTRATION_FILE = path.join(process.cwd(), '.registration_status.json');

// Check files exist
if (!fs.existsSync(CONNECTIONS_FILE)) {
  console.error('❌ Connections file not found. Run fix-agent.js first.');
  process.exit(1);
}

if (!fs.existsSync(PENDING_PROPOSALS_FILE)) {
  console.error('❌ Pending proposals file not found. Run fix-agent.js first.');
  process.exit(1);
}

// Load registration info
const registrationInfo = JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8'));

// Load pending proposals
const pendingProposals = JSON.parse(fs.readFileSync(PENDING_PROPOSALS_FILE, 'utf8'));
if (pendingProposals.length === 0) {
  console.error('❌ No pending proposals found in file.');
  process.exit(1);
}

const proposalId = pendingProposals[0].proposal.proposalId;
console.log(`Found proposal ID: ${proposalId}`);

// Create client
const client = new MockHCS10Client({
  network: 'testnet',
  operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
  operatorPrivateKey: process.env.OPERATOR_KEY || ''
});

// Create and send the approval message
async function sendApproval() {
  try {
    console.log('🚀 Sending rebalance approval message');
    
    // Create the rebalance approval data
    const approvalData = {
      type: 'RebalanceApproved',
      proposalId: proposalId,
      approvedAt: Date.now()
    };
    
    // Wrap in a HCS-10 message
    const hcs10Message = {
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify(approvalData)
    };
    
    // Send to the agent's inbound topic
    const result = await client.sendMessage(
      registrationInfo.inboundTopicId,
      JSON.stringify(hcs10Message)
    );
    
    console.log(`✅ Approval message sent: ${JSON.stringify(result)}`);
    console.log(`\nWait for the agent to process the approval...`);
    
    // Wait and check for execution
    console.log(`\nChecking for execution in 5 seconds...`);
    setTimeout(() => {
      checkForExecution();
    }, 5000);
  } catch (error) {
    console.error('❌ Error sending approval:', error);
  }
}

// Check if the proposal was executed
function checkForExecution() {
  try {
    // Check if executed proposals file exists
    if (fs.existsSync(EXECUTED_PROPOSALS_FILE)) {
      const executedProposals = JSON.parse(fs.readFileSync(EXECUTED_PROPOSALS_FILE, 'utf8'));
      
      if (executedProposals.length > 0) {
        console.log(`\n✅ Found executed proposals: ${executedProposals.length}`);
        console.log(JSON.stringify(executedProposals, null, 2));
        return;
      }
    }
    
    console.log(`❌ No executed proposals found yet`);
    
    // Check if the pending proposal was removed
    if (fs.existsSync(PENDING_PROPOSALS_FILE)) {
      const currentPendingProposals = JSON.parse(fs.readFileSync(PENDING_PROPOSALS_FILE, 'utf8'));
      
      if (currentPendingProposals.length === 0) {
        console.log(`✅ Pending proposal was processed (removed from pending)`);
      } else {
        console.log(`❌ Pending proposal still exists (not processed)`);
      }
    }
    
    console.log(`\nTry checking the agent logs to see what happened.`);
  } catch (error) {
    console.error('❌ Error checking execution:', error);
  }
}

// Run the script
sendApproval(); 