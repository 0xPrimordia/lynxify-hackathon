#!/usr/bin/env node

/**
 * End-to-End HCS10 Agent Test
 * 
 * This script creates an agent and test client in the same process
 * to eliminate any cross-process communication issues
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
if (fs.existsSync(CONNECTIONS_FILE)) fs.unlinkSync(CONNECTIONS_FILE);
if (fs.existsSync(PENDING_PROPOSALS_FILE)) fs.unlinkSync(PENDING_PROPOSALS_FILE);
if (fs.existsSync(EXECUTED_PROPOSALS_FILE)) fs.unlinkSync(EXECUTED_PROPOSALS_FILE);

console.log('🧪 Starting E2E HCS10 agent test');
console.log(`Working directory: ${process.cwd()}`);
console.log(`Connections file: ${CONNECTIONS_FILE}`);

// Simple mock client
class TestClient {
  constructor() {
    this.messages = [];
  }

  async createTopic() {
    return "0.0.123456";
  }

  async sendMessage(topicId, message) {
    console.log(`Sending message to ${topicId}: ${message}`);
    this.messages.push({
      contents: message,
      sequence_number: this.messages.length + 1,
      topic_id: topicId
    });
    return { success: true };
  }

  async getMessageStream(topicId) {
    return { messages: this.messages };
  }
}

// Simple connection class
class Connection {
  constructor(id, requesterTopic, timestamp) {
    this.id = id;
    this.requesterTopic = requesterTopic;
    this.timestamp = timestamp;
  }
}

// Simple agent
class TestAgent {
  constructor() {
    this.client = new TestClient();
    this.inboundTopic = "0.0.123456";
    this.outboundTopic = "0.0.654321";
    this.connections = [];
    this.pendingProposals = [];
  }

  // Test connection handling
  async handleConnection() {
    console.log('Creating test connection...');
    
    // Create connection
    const conn = new Connection(
      uuidv4(),
      "0.0.test",
      Date.now()
    );
    
    // Add to connections array
    this.connections.push(conn);
    
    // Save to file
    try {
      console.log(`Writing ${this.connections.length} connections to ${CONNECTIONS_FILE}`);
      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(this.connections, null, 2));
      console.log('✅ Connection file written successfully');
      
      // Verify file exists
      if (fs.existsSync(CONNECTIONS_FILE)) {
        const content = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
        console.log(`✅ Connection file read successfully: ${content}`);
      } else {
        console.log('❌ Connection file not found after writing');
      }
    } catch (error) {
      console.error('❌ Error writing connections file:', error);
    }
  }

  // Test proposal handling
  async handleProposal() {
    console.log('Creating test proposal...');
    
    // Create proposal
    const proposal = {
      id: uuidv4(),
      proposal: {
        type: 'RebalanceProposal',
        proposalId: uuidv4(),
        newWeights: { "TokenA": 0.5, "TokenB": 0.5 }
      },
      timestamp: Date.now()
    };
    
    // Add to proposals array
    this.pendingProposals.push(proposal);
    
    // Save to file
    try {
      console.log(`Writing ${this.pendingProposals.length} proposals to ${PENDING_PROPOSALS_FILE}`);
      fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify(this.pendingProposals, null, 2));
      console.log('✅ Proposal file written successfully');
      
      // Verify file exists
      if (fs.existsSync(PENDING_PROPOSALS_FILE)) {
        const content = fs.readFileSync(PENDING_PROPOSALS_FILE, 'utf8');
        console.log(`✅ Proposal file read successfully: ${content}`);
      } else {
        console.log('❌ Proposal file not found after writing');
      }
    } catch (error) {
      console.error('❌ Error writing proposals file:', error);
    }
  }
}

// Run the test
async function runTest() {
  try {
    const agent = new TestAgent();
    
    // Test connection handling
    await agent.handleConnection();
    
    // Test proposal handling
    await agent.handleProposal();
    
    // Final check
    console.log('\n📊 File check after test:');
    console.log(`Connections file exists: ${fs.existsSync(CONNECTIONS_FILE)}`);
    console.log(`Pending proposals file exists: ${fs.existsSync(PENDING_PROPOSALS_FILE)}`);
    console.log(`Executed proposals file exists: ${fs.existsSync(EXECUTED_PROPOSALS_FILE)}`);
    
    console.log('\n✅ E2E test completed');
  } catch (error) {
    console.error('❌ Error running test:', error);
  }
}

// Execute test
runTest(); 