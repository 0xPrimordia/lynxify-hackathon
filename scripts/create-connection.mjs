#!/usr/bin/env node

import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
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

if (!operatorId || !operatorKey || !agentId || !inboundTopicId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

/**
 * Main function to create a connection for testing
 */
async function main() {
  try {
    console.log('🔧 Starting connection creation...');
    
    // Create the client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Create a ConnectionsManager
    console.log('🔄 Creating ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      baseClient: client
    });
    
    console.log('✅ ConnectionsManager created');
    
    // Target parameters - connecting to self for testing
    const targetAgentId = agentId;
    const targetInboundTopicId = inboundTopicId;
    
    console.log(`🔄 Creating connection to agent ${targetAgentId} on topic ${targetInboundTopicId}...`);
    
    // Create a connection request (approach 1)
    try {
      console.log('Attempt 1: Using ConnectionsManager.createConnectionRequest()');
      const connectionRequest = await connectionsManager.createConnectionRequest(
        targetAgentId,
        targetInboundTopicId
      );
      
      console.log('✅ Connection request created with ConnectionsManager:', connectionRequest);
    } catch (err1) {
      console.error('❌ Error creating connection with ConnectionsManager:', err1);
      
      // Try direct method (approach 2)
      try {
        console.log('Attempt 2: Using client.createConnectionRequest()');
        const connectionRequest = await client.createConnectionRequest({
          accountId: targetAgentId,
          inboundTopicId: targetInboundTopicId
        });
        
        console.log('✅ Connection request created with client:', connectionRequest);
      } catch (err2) {
        console.error('❌ Error creating connection with client:', err2);
      }
    }
    
    // Fetch connections to verify
    console.log('🔄 Fetching connections to verify...');
    const connections = await connectionsManager.fetchConnectionData(operatorId);
    console.log(`✅ Found ${connections.length} connections total`);
    
    // Save connections to file for reference
    const connectionsList = connectionsManager.getAllConnections();
    
    // Convert to save format
    const formattedConnections = connectionsList.map(conn => ({
      id: conn.connectionTopicId,
      connectionTopicId: conn.connectionTopicId,
      requesterId: conn.targetAccountId,
      status: conn.status,
      establishedAt: conn.created?.getTime() || Date.now()
    }));
    
    // Save to file
    const connectionsFile = path.join(process.cwd(), '.connections.json');
    await fs.writeFile(connectionsFile, JSON.stringify(formattedConnections, null, 2));
    console.log(`✅ Saved ${formattedConnections.length} connections to file`);
    
    // List connection details
    if (formattedConnections.length > 0) {
      console.log('📋 Connection details:');
      formattedConnections.forEach((conn, idx) => {
        console.log(`Connection ${idx+1}:`, JSON.stringify(conn, null, 2));
      });
    }
    
    console.log('✅ Connection creation completed');
  } catch (error) {
    console.error('❌ Error creating connection:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 