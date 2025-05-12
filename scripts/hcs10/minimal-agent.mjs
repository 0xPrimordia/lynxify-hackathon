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

/**
 * Main function to run a minimal HCS-10 agent
 * Based directly on the standards-expert-agent.ts example
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
    
    // Initialize client basic listeners - handle messages directly
    console.log('🔄 Setting up message handlers...');
    
    // This simpler version directly handles message types from the client
    client.on('message', async (message) => {
      console.log('📩 Received message:', JSON.stringify(message, null, 2));
      
      // If it's a direct message, respond
      if (message.op === 'message' && message.connectionTopicId) {
        let textToRespond = message.text || message.data?.text || 'Hello!';
        if (typeof message.data === 'string') {
          try {
            const data = JSON.parse(message.data);
            textToRespond = data.text || textToRespond;
          } catch (e) {
            // Use the original text if parsing fails
          }
        }
        
        console.log(`🔄 Responding to message on connection ${message.connectionTopicId}`);
        
        const response = {
          p: 'hcs-10',
          op: 'message',
          text: `Thank you for your message: "${textToRespond}". This is the Lynxify agent responding directly to you.`,
          timestamp: new Date().toISOString()
        };
        
        try {
          await client.sendMessage(message.connectionTopicId, JSON.stringify(response));
          console.log('✅ Response sent successfully');
        } catch (error) {
          console.error('❌ Error sending response:', error);
        }
      }
      
      // If it's a connection request, approve it automatically
      if (message.op === 'connection_request') {
        try {
          console.log('🔄 Processing connection request');
          await client.handleConnectionRequest(inboundTopicId, message.requesterId, message.id);
          console.log('✅ Connection request approved');
        } catch (error) {
          console.error('❌ Error approving connection:', error);
        }
      }
    });
    
    // Handle errors
    client.on('error', (error) => {
      console.error('❌ Client error:', error);
    });
    
    // Start polling for messages - critical part
    console.log('🔄 Starting to poll for messages on topics...');
    
    // Function to check for messages
    async function checkForMessages() {
      try {
        // Check inbound topic
        console.log(`🔄 Checking inbound topic ${inboundTopicId} for messages...`);
        const messages = await client.getMessageStream(inboundTopicId);
        console.log(`Found ${messages?.length || 0} messages on inbound topic`);
        
        // Check all known connection topics too
        const connections = await client.getConnections();
        console.log(`Found ${connections?.length || 0} connections to check`);
        
        for (const connection of (connections || [])) {
          if (connection.connectionTopicId) {
            console.log(`🔄 Checking connection topic ${connection.connectionTopicId}...`);
            try {
              const connMessages = await client.getMessageStream(connection.connectionTopicId);
              console.log(`Found ${connMessages?.length || 0} messages on connection topic`);
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