#!/usr/bin/env node

import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment check
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;

if (!operatorId || !operatorKey || !agentId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Path for connections file
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');

/**
 * Main function to test agent messaging
 */
async function main() {
  try {
    console.log('🔧 Starting agent message test...');
    
    // Create the client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Check if connections file exists
    let connections = [];
    try {
      const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
      connections = JSON.parse(data);
      console.log(`📋 Found ${connections.length} connections in file`);
    } catch (err) {
      console.log('⚠️ No connections file found or invalid JSON');
    }
    
    if (connections.length === 0) {
      console.error('❌ No connections found. Please establish a connection first.');
      process.exit(1);
    }
    
    // Use the first connection
    const connection = connections[0];
    console.log(`📌 Using connection: ${connection.connectionTopicId}`);
    
    // Send a test message
    const testMessage = {
      p: 'hcs-10',
      op: 'message',
      text: 'Hello, this is a test message',
      timestamp: new Date().toISOString()
    };
    
    console.log('🔄 Sending test message:', JSON.stringify(testMessage, null, 2));
    await client.sendMessage(connection.connectionTopicId, JSON.stringify(testMessage));
    console.log('✅ Test message sent successfully');
    
    console.log('🔍 Waiting for response (will check for 30 seconds)...');
    
    // Wait and check for responses
    for (let i = 0; i < 15; i++) {
      console.log(`🔄 Checking for messages (attempt ${i+1}/15)...`);
      const messages = await client.getMessages(connection.connectionTopicId);
      
      // Look for messages in the last minute
      const recentMessages = messages.filter(msg => {
        try {
          const timestamp = new Date(msg.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - timestamp.getTime();
          const diffSec = diffMs / 1000;
          return diffSec < 60; // Messages from the last minute
        } catch (e) {
          return false;
        }
      });
      
      if (recentMessages.length > 0) {
        console.log(`✅ Found ${recentMessages.length} recent messages:`);
        recentMessages.forEach((msg, idx) => {
          console.log(`📩 Message ${idx+1}:`, JSON.stringify(msg, null, 2));
        });
      } else {
        console.log('⚠️ No recent messages found');
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('✅ Message test completed');
  } catch (error) {
    console.error('❌ Error testing agent message:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 