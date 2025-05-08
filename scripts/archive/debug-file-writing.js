#!/usr/bin/env node

/**
 * Debug File Writing
 * Simple script to test file writing with the same paths used by HCS10Agent
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths - exactly the same as in hcs10-agent.ts
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = path.join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = path.join(process.cwd(), '.executed_proposals.json');

// Test data
const testData = {
  connections: [{ id: 'test-connection-id', requesterTopic: 'test-topic', timestamp: Date.now() }],
  pendingProposals: [{ id: 'test-proposal-id', proposal: { type: 'RebalanceProposal', proposalId: 'test-proposal-id' }, timestamp: Date.now() }],
  executedProposals: [{ id: 'test-execution-id', proposalId: 'test-proposal-id', executedAt: Date.now() }]
};

// Main function
async function main() {
  console.log('🔍 DEBUG: Testing file writing with HCS10Agent paths');
  console.log(`Current working directory: ${process.cwd()}`);
  
  // Try writing connections file
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(testData.connections, null, 2));
    console.log(`✅ Successfully wrote to ${CONNECTIONS_FILE}`);
    
    // Verify file was created
    if (fs.existsSync(CONNECTIONS_FILE)) {
      console.log(`✅ File exists after saving: ${CONNECTIONS_FILE}`);
      
      // Read the file back
      const content = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
      console.log('✅ Content read back successfully:', content);
    } else {
      console.log(`❌ File does not exist after saving: ${CONNECTIONS_FILE}`);
    }
  } catch (error) {
    console.error(`❌ Error writing connections file:`, error);
  }
  
  // Try writing pending proposals file
  try {
    fs.writeFileSync(PENDING_PROPOSALS_FILE, JSON.stringify(testData.pendingProposals, null, 2));
    console.log(`✅ Successfully wrote to ${PENDING_PROPOSALS_FILE}`);
  } catch (error) {
    console.error(`❌ Error writing pending proposals file:`, error);
  }
  
  // Try writing executed proposals file
  try {
    fs.writeFileSync(EXECUTED_PROPOSALS_FILE, JSON.stringify(testData.executedProposals, null, 2));
    console.log(`✅ Successfully wrote to ${EXECUTED_PROPOSALS_FILE}`);
  } catch (error) {
    console.error(`❌ Error writing executed proposals file:`, error);
  }
  
  console.log('\n📊 File check after writing:');
  console.log(`Connections file exists: ${fs.existsSync(CONNECTIONS_FILE)}`);
  console.log(`Pending proposals file exists: ${fs.existsSync(PENDING_PROPOSALS_FILE)}`);
  console.log(`Executed proposals file exists: ${fs.existsSync(EXECUTED_PROPOSALS_FILE)}`);
}

// Run the test
main(); 