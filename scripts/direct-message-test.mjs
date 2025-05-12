#!/usr/bin/env node

import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment check
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;

if (!operatorId || !operatorKey || !agentId || !inboundTopicId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Hard-coded connection topic IDs from logs (use the one from your logs)
const connectionTopics = [
  '0.0.5988861',
  '0.0.5988849',
  '0.0.5988480',
  '0.0.5988416',
  inboundTopicId  // Also try sending directly to the agent's inbound topic
];

/**
 * Main function to test messaging
 */
async function main() {
  try {
    console.log('🔧 Starting direct message test...');
    
    // Create the client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Try each connection topic
    for (const topicId of connectionTopics) {
      console.log(`\n🔄 Testing message to topic ${topicId}...`);
      
      // Send message in various formats to maximize chance of success
      
      // Format 1: Standard HCS-10 format
      const message1 = {
        p: 'hcs-10',
        op: 'message',
        text: `Hello from test script! Standard format. Timestamp: ${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending message format 1:', JSON.stringify(message1, null, 2));
      try {
        await client.sendMessage(topicId, JSON.stringify(message1));
        console.log('✅ Message 1 sent successfully');
      } catch (error) {
        console.error('❌ Error sending message 1:', error.message);
      }
      
      // Wait 2 seconds between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Format 2: Alternative format with data field
      const message2 = {
        op: 'message',
        data: JSON.stringify({
          text: `Hello from test script! Data field format. Timestamp: ${Date.now()}`
        }),
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending message format 2:', JSON.stringify(message2, null, 2));
      try {
        await client.sendMessage(topicId, JSON.stringify(message2));
        console.log('✅ Message 2 sent successfully');
      } catch (error) {
        console.error('❌ Error sending message 2:', error.message);
      }
      
      // Wait 2 seconds between topics
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Wait and check for responses
    console.log('\n🔍 Waiting for responses (will check for 20 seconds)...');
    
    for (let i = 0; i < 10; i++) {
      console.log(`\n🔄 Check ${i + 1}/10: Checking for responses...`);
      
      for (const topicId of connectionTopics) {
        try {
          console.log(`🔍 Checking topic ${topicId}...`);
          const messages = await client.getMessages(topicId);
          
          // Check if we got an array
          if (!Array.isArray(messages)) {
            console.log(`⚠️ Got non-array response from ${topicId}:`, messages);
            continue;
          }
          
          // Find recent messages
          const recentMessages = messages.filter(msg => {
            try {
              const msgTime = new Date(msg.timestamp || msg.created || Date.now());
              const diffMs = Date.now() - msgTime.getTime();
              return diffMs < 30000; // Messages in the last 30 seconds
            } catch (e) {
              return false;
            }
          });
          
          if (recentMessages.length > 0) {
            console.log(`✅ Found ${recentMessages.length} recent messages on ${topicId}`);
            recentMessages.forEach((msg, idx) => {
              console.log(`📩 Message ${idx + 1}:`, JSON.stringify(msg, null, 2));
            });
          } else {
            console.log(`ℹ️ No recent messages found on ${topicId}`);
          }
        } catch (error) {
          console.error(`❌ Error checking messages on ${topicId}:`, error.message);
        }
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ Direct message test completed');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 