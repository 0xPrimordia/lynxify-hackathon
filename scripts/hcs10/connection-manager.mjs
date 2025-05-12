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

// Constants
const CONNECTION_STATE_FILE = '.connection_state.json';
const POLL_INTERVAL_MS = 5000;

/**
 * Saves connections to a local file
 */
async function saveConnectionState(connections) {
  try {
    await fs.writeFile(
      CONNECTION_STATE_FILE,
      JSON.stringify(connections, null, 2),
      'utf8'
    );
    console.log('✅ Connection state saved');
  } catch (error) {
    console.error('❌ Error saving connection state:', error);
  }
}

/**
 * Loads connections from a local file
 */
async function loadConnectionState() {
  try {
    const data = await fs.readFile(CONNECTION_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('ℹ️ No saved connection state found, starting fresh');
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting HCS-10 Connection Manager...');

  try {
    // Create the client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    console.log('✅ HCS10 client created');

    // Load existing connection state
    let knownConnections = await loadConnectionState();
    console.log(`ℹ️ Loaded ${knownConnections.length} known connections`);

    // Connection management loop
    async function manageConnections() {
      try {
        // Get established connections from the network
        const establishedConnections = await client.getConnectionsByState('established') || [];
        console.log(`ℹ️ Found ${establishedConnections.length} established connections on the network`);

        // Get pending connections
        const pendingConnections = await client.getPendingConnections() || [];
        console.log(`ℹ️ Found ${pendingConnections.length} pending connections`);

        // Combine both types of connections
        const currentConnections = [...establishedConnections, ...pendingConnections];

        // Check for new connections
        const newConnections = currentConnections.filter(
          conn => !knownConnections.some(known => known.connectionTopicId === conn.connectionTopicId)
        );

        if (newConnections.length > 0) {
          console.log(`🆕 Found ${newConnections.length} new connections`);
          
          // Add new connections to known list
          knownConnections = [...knownConnections, ...newConnections];
          
          // Save updated connections
          await saveConnectionState(knownConnections);
          
          // Log the new connections
          for (const conn of newConnections) {
            console.log(`📝 New connection: ${conn.connectionTopicId} with ${conn.targetAgentName || 'Unknown Agent'}`);
          }
        }

        // Check for any pending connection requests
        console.log('🔍 Checking for pending connection requests...');
        try {
          // Check for connection requests in inbound topic messages
          const timestamp = Date.now() - 60000; // Get messages from the last minute
          const messages = await client.getMessagesByTimestamp(inboundTopicId, timestamp);
          
          if (Array.isArray(messages) && messages.length > 0) {
            const connectionRequests = messages.filter(msg => 
              msg.op === 'connection_request' && !msg.processed
            );
            
            if (connectionRequests.length > 0) {
              console.log(`📬 Found ${connectionRequests.length} connection requests`);
              
              // Process each connection request
              for (const request of connectionRequests) {
                try {
                  console.log(`🔄 Processing connection request from ${request.requesterId}`);
                  await client.acceptConnection(request.id, {
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
            } else {
              console.log('ℹ️ No pending connection requests');
            }
          }
        } catch (error) {
          console.error('❌ Error checking for connection requests:', error);
        }

        // Read the approval commands file
        try {
          const approvalFile = await fs.readFile('.approval_commands.json', 'utf8');
          const approvalCommands = JSON.parse(approvalFile);
          
          if (approvalCommands && approvalCommands.length > 0) {
            console.log(`📝 Found ${approvalCommands.length} approval commands to process`);
            
            for (const cmd of approvalCommands) {
              if (cmd.action === 'approve' && cmd.connectionId) {
                console.log(`🔄 Processing approval for connection ${cmd.connectionId}`);
                try {
                  await client.acceptConnection(cmd.connectionId, {
                    memo: cmd.memo || "Connection accepted via UI approval",
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
                  console.log(`✅ Connection ${cmd.connectionId} approved`);
                } catch (error) {
                  console.error(`❌ Error approving connection ${cmd.connectionId}:`, error);
                }
              }
            }
            
            // Clear the approval commands file
            await fs.writeFile('.approval_commands.json', JSON.stringify([]), 'utf8');
          }
        } catch (error) {
          // Ignore if file doesn't exist
          if (error.code !== 'ENOENT') {
            console.error('❌ Error processing approval commands:', error);
          }
        }
      } catch (error) {
        console.error('❌ Error in connection management:', error);
      }
      
      // Schedule next check
      setTimeout(manageConnections, POLL_INTERVAL_MS);
    }

    // Start managing connections
    manageConnections();
    
    console.log(`✅ Connection Manager is running and polling every ${POLL_INTERVAL_MS/1000} seconds`);
    
    // Keep the process running indefinitely
    await new Promise(() => {});
    
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