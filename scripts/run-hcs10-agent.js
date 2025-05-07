#!/usr/bin/env node

/**
 * HCS-10 Agent Runner
 * This script runs the HCS-10 agent with our mock client implementation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

// Import our mock client and agent
// Note: The path needs to match the output directory from tsconfig.hcs10.json
import { MockHCS10Client } from '../dist-hcs10/src/lib/mock-hcs10-client.js';
import { HCS10Agent } from '../dist-hcs10/src/lib/hcs10-agent.js';

// Constants
const REGISTRATION_FILE = join(process.cwd(), '.registration_status.json');
const CONNECTIONS_FILE = join(process.cwd(), '.connections.json');
const PENDING_PROPOSALS_FILE = join(process.cwd(), '.pending_proposals.json');
const EXECUTED_PROPOSALS_FILE = join(process.cwd(), '.executed_proposals.json');

// Log with timestamp
function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Check if file exists
function checkFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    log(`Error checking file ${filePath}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    log('🚀 Starting HCS-10 Agent with Mock Client');
    
    // Verify file paths
    log(`Working directory: ${process.cwd()}`);
    log(`Connections file path: ${CONNECTIONS_FILE}`);
    log(`Pending proposals file path: ${PENDING_PROPOSALS_FILE}`);
    log(`Executed proposals file path: ${EXECUTED_PROPOSALS_FILE}`);
    
    // Check file permissions
    log('Checking file write permissions...');
    try {
      fs.accessSync(process.cwd(), fs.constants.W_OK);
      log('✅ Directory is writable');
    } catch (error) {
      log(`❌ Cannot write to directory: ${error.message}`);
    }
    
    // Clean up existing files for clean test
    if (checkFile(CONNECTIONS_FILE)) {
      fs.unlinkSync(CONNECTIONS_FILE);
      log(`Removed existing connections file for clean test`);
    }
    
    if (checkFile(PENDING_PROPOSALS_FILE)) {
      fs.unlinkSync(PENDING_PROPOSALS_FILE);
      log(`Removed existing pending proposals file for clean test`);
    }
    
    if (checkFile(EXECUTED_PROPOSALS_FILE)) {
      fs.unlinkSync(EXECUTED_PROPOSALS_FILE);
      log(`Removed existing executed proposals file for clean test`);
    }
    
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
    
    // Create agent
    const agent = new HCS10Agent(
      client,
      registrationInfo.inboundTopicId,
      registrationInfo.outboundTopicId
    );
    
    log('✅ HCS10 agent created');
    
    // Start the agent
    agent.start(5000); // Poll every 5 seconds
    
    log('✅ Agent started successfully');
    log('🔄 Agent is running. Press Ctrl+C to exit.');
    
    // Handle cleanup
    process.on('SIGINT', () => {
      log('🛑 Shutting down agent...');
      agent.stop();
      log('👋 Goodbye!');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log('🛑 Shutting down agent...');
      agent.stop();
      log('👋 Goodbye!');
      process.exit(0);
    });
    
    // Periodically check for file creation
    setInterval(() => {
      log('\n📊 File status check:');
      log(`Connections file exists: ${checkFile(CONNECTIONS_FILE)}`);
      log(`Pending proposals file exists: ${checkFile(PENDING_PROPOSALS_FILE)}`);
      log(`Executed proposals file exists: ${checkFile(EXECUTED_PROPOSALS_FILE)}`);
    }, 10000);
    
  } catch (error) {
    log(`❌ Error running agent: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main(); 