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
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;

if (!operatorId || !operatorKey || !agentId || !inboundTopicId || !outboundTopicId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Track processed messages to avoid duplicates
const processedMessages = new Set();

/**
 * Process a message and respond if needed
 */
async function processMessage(client, message) {
  try {
    // Generate a unique key for this message to avoid processing duplicates
    const messageKey = `${message.topic_id || message.connectionTopicId}-${message.sequence_number || message.id}`;
    
    // Skip if already processed
    if (processedMessages.has(messageKey)) {
      return;
    }
    
    // Mark as processed
    processedMessages.add(messageKey);
    
    console.log('📩 Processing message:', JSON.stringify(message, null, 2));
    
    // Handle direct messages
    if (message.op === 'message' && (message.connectionTopicId || message.topic_id)) {
      const connectionId = message.connectionTopicId || message.topic_id;
      
      // Extract text from various formats
      let textToRespond = message.text || 'Hello!';
      
      if (message.data) {
        if (typeof message.data === 'string') {
          try {
            const data = JSON.parse(message.data);
            textToRespond = data.text || textToRespond;
          } catch (e) {
            // Use the original text if parsing fails
          }
        } else if (typeof message.data === 'object') {
          textToRespond = message.data.text || textToRespond;
        }
      }
      
      console.log(`🔄 Responding to message on connection ${connectionId}`);
      
      const response = {
        p: 'hcs-10',
        op: 'message',
        text: `Thank you for your message: "${textToRespond}". This is the Lynxify agent responding directly to you.`,
        timestamp: new Date().toISOString()
      };
      
      try {
        await client.sendMessage(connectionId, JSON.stringify(response));
        console.log('✅ Response sent successfully');
      } catch (error) {
        console.error('❌ Error sending response:', error);
      }
    }
    
    // Handle connection requests
    if (message.op === 'connection_request') {
      try {
        console.log('🔄 Processing connection request');
        await client.acceptConnection(message.id, {
          memo: "Connection accepted. Looking forward to collaborating!",
          profileInfo: {
            version: "1.0",
            type: 0,
            display_name: "Lynxify Agent",
            alias: "lynxify_agent",
            bio: "Testnet agent for the Lynx tokenized index",
            properties: {
              organization: "Lynxify"
            },
            inboundTopicId,
            outboundTopicId
          }
        });
        console.log('✅ Connection request approved');
      } catch (error) {
        console.error('❌ Error approving connection:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error processing message:', error);
  }
}

/**
 * Main function to run a minimal HCS-10 agent
 * Based on the standards-expert-agent example from the documentation
 */
async function main() {
  try {
    console.log('🚀 Starting minimal HCS-10 agent...');
    
    // Create the client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Start polling for messages
    console.log('🔄 Starting to poll for messages on topics...');
    
    // Function to check for messages
    async function checkForMessages() {
      try {
        // Get last minute of messages from inbound topic
        const timestamp = Date.now() - 60000; // Last minute
        console.log(`🔄 Checking inbound topic ${inboundTopicId} for messages since ${new Date(timestamp).toISOString()}...`);
        const messages = await client.getMessagesByTimestamp(inboundTopicId, timestamp);
        
        if (Array.isArray(messages) && messages.length > 0) {
          console.log(`📬 Found ${messages.length} messages on inbound topic`);
          
          // Process each message
          for (const message of messages) {
            await processMessage(client, message);
          }
        } else {
          console.log('ℹ️ No new messages on inbound topic');
        }
        
        // Check all established connections too
        const connections = await client.getConnectionsByState('established');
        console.log(`Found ${connections?.length || 0} established connections to check`);
        
        for (const connection of (connections || [])) {
          if (connection.connectionTopicId) {
            console.log(`🔄 Checking connection topic ${connection.connectionTopicId}...`);
            try {
              const connMessages = await client.getMessagesByTimestamp(connection.connectionTopicId, timestamp);
              
              if (Array.isArray(connMessages) && connMessages.length > 0) {
                console.log(`📬 Found ${connMessages.length} messages on connection topic ${connection.connectionTopicId}`);
                
                // Process each message
                for (const message of connMessages) {
                  // Add connection topic ID if not present
                  if (!message.connectionTopicId) {
                    message.connectionTopicId = connection.connectionTopicId;
                  }
                  await processMessage(client, message);
                }
              } else {
                console.log(`ℹ️ No new messages on connection topic ${connection.connectionTopicId}`);
              }
            } catch (e) {
              console.error(`❌ Error checking connection topic ${connection.connectionTopicId}:`, e);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking for messages:', error);
      }
      
      // Schedule next check
      setTimeout(checkForMessages, 2000);
    }
    
    // Start checking for messages
    checkForMessages();
    
    console.log('✅ Agent is now running and polling for messages every 2 seconds');
    
    // Keep the process running indefinitely
    await new Promise(() => {
      console.log('🔄 Agent will continue running until process is stopped');
    });
    
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