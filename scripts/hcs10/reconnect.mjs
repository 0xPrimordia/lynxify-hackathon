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

// File to store connection state
const CONNECTION_STATE_FILE = '.connection_state.json';

/**
 * Loads connections from a local file
 */
async function loadConnectionState() {
  try {
    const data = await fs.readFile(CONNECTION_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('ℹ️ No saved connection state found');
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting HCS-10 Reconnection Script...');

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

    // Load saved connections
    const savedConnections = await loadConnectionState();
    console.log(`ℹ️ Loaded ${savedConnections.length} saved connections`);

    // Get current connections from the network
    const establishedConnections = await client.getConnectionsByState('established') || [];
    console.log(`ℹ️ Found ${establishedConnections.length} active connections on the network`);

    // Identify missing connections (those in saved state but not in current connections)
    const missingConnections = savedConnections.filter(
      saved => !establishedConnections.some(current => current.connectionTopicId === saved.connectionTopicId)
    );
    
    console.log(`🔍 Found ${missingConnections.length} missing connections to restore`);

    // Attempt to reconnect to each missing connection
    for (const connection of missingConnections) {
      try {
        if (connection.targetInboundTopicId && connection.targetAccountId) {
          console.log(`🔄 Attempting to reconnect to ${connection.targetAgentName || 'Unknown Agent'} (${connection.targetAccountId})`);
          
          // First check if the agent is registered
          const agentInfo = await client.getAgentInfoByAccountId(connection.targetAccountId);
          
          if (agentInfo) {
            console.log(`✅ Found agent info for ${connection.targetAccountId}`);
            
            // Send connection request
            const requestId = await client.requestConnection({
              targetAgentId: connection.targetAccountId,
              targetInboundTopicId: connection.targetInboundTopicId,
              memo: "Reconnection request from Lynxify agent",
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
            
            console.log(`✅ Sent connection request with ID: ${requestId}`);
          } else {
            console.log(`❌ Agent ${connection.targetAccountId} not found in registry`);
          }
        } else {
          console.log(`❌ Missing required information for ${connection.connectionTopicId}`);
        }
      } catch (error) {
        console.error(`❌ Error reconnecting to ${connection.targetAgentName || 'Unknown Agent'}:`, error);
      }
    }

    console.log('✅ Reconnection attempts completed');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }); 