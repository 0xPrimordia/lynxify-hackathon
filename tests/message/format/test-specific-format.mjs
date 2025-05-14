#!/usr/bin/env node

/**
 * Test: test-specific-format
 * 
 * Purpose: Tests specific message formats to isolate format-specific issues
 * in the agent's message handling.
 * 
 * Usage:
 *   node test-specific-format.mjs --format=<format-name>
 * 
 * Available formats:
 *   - plain-text: Simple text message
 *   - json-text: JSON with text property
 *   - nested-object: Nested object with query
 *   - string-data: String in data property
 *   - sequence-number: Message with sequence number
 *   - all: Tests all formats in sequence
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Setup path and environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });

// Import the HCS10Client
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Message formats to test
const messageFormats = {
  'plain-text': {
    p: 'hcs-10',
    op: 'message',
    text: 'This is a plain text message',
    timestamp: new Date().toISOString()
  },
  'json-text': {
    p: 'hcs-10',
    op: 'message',
    text: JSON.stringify({ message: 'This is a message in JSON text field' }),
    timestamp: new Date().toISOString()
  },
  'nested-object': {
    p: 'hcs-10',
    op: 'message',
    data: {
      query: {
        text: 'This is a nested query object'
      }
    },
    timestamp: new Date().toISOString()
  },
  'string-data': {
    p: 'hcs-10',
    op: 'message',
    data: 'This is a string in the data field',
    timestamp: new Date().toISOString()
  },
  'sequence-number': {
    p: 'hcs-10',
    op: 'message',
    text: 'Message with sequence number',
    sequence_number: Math.floor(Math.random() * 1000000),
    timestamp: new Date().toISOString()
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
let formatToTest = 'plain-text'; // Default

for (const arg of args) {
  if (arg.startsWith('--format=')) {
    formatToTest = arg.split('=')[1];
    break;
  }
}

async function main() {
  try {
    console.log('🔍 Testing specific message format: ' + formatToTest);
    
    // Initialize HCS10Client
    console.log('🔄 Initializing HCS10Client...');
    const client = new HCS10Client({
      network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
      operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
      operatorPrivateKey: process.env.OPERATOR_KEY,
    });
    
    // Get a valid connection from .connections.json
    console.log('🔄 Finding valid connection...');
    const connectionsData = await fs.readFile(path.join(PROJECT_ROOT, '.connections.json'), 'utf8');
    const connections = JSON.parse(connectionsData);
    
    const validConnection = connections.find(c => 
      c.status === 'established' && 
      c.connectionTopicId?.match(/^0\.0\.\d+$/)
    );
    
    if (!validConnection) {
      console.error('❌ No valid established connection found in .connections.json');
      return;
    }
    
    const topicId = validConnection.connectionTopicId;
    console.log(`✅ Using connection topic: ${topicId}`);
    
    // Define which formats to test
    const formatsToTest = formatToTest === 'all' 
      ? Object.keys(messageFormats) 
      : [formatToTest];
    
    // Set up message polling
    let latestResponseTimestamp = Date.now();
    const pollInterval = 2000; // 2 seconds
    const maxPollingTime = 30000; // 30 seconds
    let responseReceived = false;
    
    const pollForResponses = async () => {
      const startTime = Date.now();
      
      console.log('🔄 Polling for responses...');
      
      // Keep polling until timeout
      while (Date.now() - startTime < maxPollingTime) {
        try {
          const messages = await client.getMessagesFromTopic(topicId, latestResponseTimestamp);
          
          if (messages.length > 0) {
            console.log(`✅ Received ${messages.length} messages`);
            
            // Process each message
            for (const message of messages) {
              // Skip our own messages
              if (message.operator_id && message.operator_id.includes(process.env.NEXT_PUBLIC_OPERATOR_ID)) {
                continue;
              }
              
              console.log(`📥 Response: ${JSON.stringify(message, null, 2)}`);
              responseReceived = true;
              
              // Update timestamp for next poll
              if (message.created) {
                latestResponseTimestamp = message.created.getTime();
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error polling messages: ${error.message}`);
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      if (!responseReceived) {
        console.log('❌ No response received within the polling time');
      }
    };
    
    // Start polling in the background
    const pollingPromise = pollForResponses();
    
    // Send test messages for each format
    for (const format of formatsToTest) {
      if (!messageFormats[format]) {
        console.log(`❌ Unknown format: ${format}`);
        continue;
      }
      
      const message = messageFormats[format];
      console.log(`📤 Sending ${format} message: ${JSON.stringify(message, null, 2)}`);
      
      try {
        await client.sendMessage(topicId, JSON.stringify(message));
        console.log(`✅ ${format} message sent successfully`);
        
        // Wait between formats if testing multiple
        if (formatsToTest.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`❌ Error sending ${format} message: ${error.message}`);
      }
    }
    
    // Wait for polling to complete
    await pollingPromise;
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`🔍 Formats tested: ${formatsToTest.join(', ')}`);
    console.log(`📤 Messages sent: ${formatsToTest.length}`);
    console.log(`📥 Response received: ${responseReceived ? 'Yes' : 'No'}`);
    console.log(`⏱️ Total test time: ${(Date.now() - latestResponseTimestamp) / 1000} seconds`);
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
  }
}

main(); 