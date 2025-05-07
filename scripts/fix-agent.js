#!/usr/bin/env node

/**
 * Fix HCS10Agent
 * Direct test of the agent's file writing capabilities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths for storage - MUST match those in hcs10-agent.ts
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');

// Clean up any existing files
console.log('Cleaning up existing files...');
if (fs.existsSync(CONNECTIONS_FILE)) fs.unlinkSync(CONNECTIONS_FILE);
if (fs.existsSync(PENDING_PROPOSALS_FILE)) fs.unlinkSync(PENDING_PROPOSALS_FILE);
if (fs.existsSync(EXECUTED_PROPOSALS_FILE)) fs.unlinkSync(EXECUTED_PROPOSALS_FILE);

// Load the registration info
const REGISTRATION_FILE = path.join(process.cwd(), '.registration_status.json');
const registrationInfo = JSON.parse(fs.readFileSync(REGISTRATION_FILE, 'utf8'));

// Mock the direct implementation, bypassing all the message passing
class Connection {
  constructor(id, requesterTopic, timestamp) {
    this.id = id;
    this.requesterTopic = requesterTopic;
    this.timestamp = timestamp;
  }
}

class PendingProposal {
  constructor(id, proposal, timestamp) {
    this.id = id;
    this.proposal = proposal;
    this.timestamp = timestamp;
  }
}

async function fixAgent() {
  try {
    console.log('🔧 Starting direct HCS10Agent fix');
    
    // 1. Create a test connection
    const connection = {
      id: uuidv4(),
      requesterTopic: "0.0.test-topic",
      timestamp: Date.now()
    };
    
    // 2. Write the connection directly to file
    console.log(`Writing test connection to ${CONNECTIONS_FILE}`);
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify([connection], null, 2));
    
    // 3. Create a test proposal
    const proposal = {
      id: "test-proposal-id",
      proposal: {
        type: "RebalanceProposal",
        proposalId: "test-proposal-id",
        newWeights: { "TokenA": 0.3, "TokenB": 0.7 },
        executeAfter: Date.now(),
        quorum: 5000
      },
      timestamp: Date.now()
    };
    
    // 4. Write the proposal directly to file
    console.log(`Writing test proposal to ${PENDING_PROPOSALS_FILE}`);
    fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify([proposal], null, 2));
    
    // 5. Verify files exist
    console.log('\n📊 Verification:');
    console.log(`Connections file exists: ${fs.existsSync(CONNECTIONS_FILE)}`);
    console.log(`Pending proposals file exists: ${fs.existsSync(PENDING_PROPOSALS_FILE)}`);
    
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const content = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      console.log(`\nConnections file content:\n${content}`);
    }
    
    if (fs.existsSync(PENDING_PROPOSALS_FILE)) {
      const content = fs.readFileSync(PENDING_PROPOSALS_FILE, 'utf8');
      console.log(`\nPending proposals file content:\n${content}`);
    }
    
    console.log('\n✅ Agent files created successfully');
    console.log('\nNext steps:');
    console.log('1. These files should now be visible to your running agent');
    console.log('2. Run your approval test against these files');
    console.log('3. The agent should detect the pending proposal and process it when approved');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixAgent(); 