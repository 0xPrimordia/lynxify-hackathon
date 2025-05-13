#!/usr/bin/env node

import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Validate required environment variables
const requiredVars = [
  'OPERATOR_KEY',
  'NEXT_PUBLIC_HCS_AGENT_ID',
  'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
  'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC'
];

const missing = requiredVars.filter(varName => !process.env[varName]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

// Configuration
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
const agentKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;

/**
 * Main function to clean up duplicate connections
 */
async function main() {
  console.log('🧹 Starting connection cleanup process...');
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Inbound Topic: ${inboundTopicId}`);
  console.log(`   Outbound Topic: ${outboundTopicId}`);
  
  try {
    // Create HCS10 client with proper configuration
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId: agentId,
      operatorKey: agentKey,
      useEncryption: false,
      signatureKey: agentKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Initialize ConnectionsManager properly
    console.log('🔄 Initializing ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      client: client,
      logLevel: 'info',
      prettyPrint: true
    });
    
    console.log('✅ ConnectionsManager initialized');
    
    // Set agent info required for proper connection management
    await connectionsManager.setAgentInfo({
      accountId: agentId,
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId
    });
    
    // Fetch connection data to load existing connections
    console.log('🔄 Fetching connections from Hedera...');
    await connectionsManager.fetchConnectionData(agentId);
    
    // Get all connections
    const allConnections = connectionsManager.getAllConnections();
    console.log(`Found ${allConnections.length} total connections`);
    
    // Get active connections for cleanup
    const activeConnections = connectionsManager.getActiveConnections();
    console.log(`Found ${activeConnections.length} active connections to close`);
    
    // Close connections one by one
    let closedCount = 0;
    let errorCount = 0;
    
    for (const connection of activeConnections) {
      try {
        console.log(`🔄 Closing connection to ${connection.targetAccountId} (${connection.connectionTopicId})`);
        
        // Send close_connection message to the connection topic
        const closeMessage = {
          p: 'hcs-10',
          op: 'close_connection',
          reason: 'Cleaning up duplicate connections'
        };
        
        await client.sendMessage(
          connection.connectionTopicId, 
          JSON.stringify(closeMessage)
        );
        
        console.log(`✅ Sent close message to ${connection.connectionTopicId}`);
        
        // Update the connection status in the ConnectionsManager
        connection.status = 'closed';
        connectionsManager.updateOrAddConnection(connection);
        
        closedCount++;
      } catch (error) {
        console.error(`❌ Error closing connection ${connection.connectionTopicId}:`, error.message);
        errorCount++;
      }
      
      // Delay between operations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save connections state
    console.log(`🔄 Saving updated connection state...`);
    await connectionsManager.persistConnections();
    
    // Backup connections file for recovery if needed
    const backupPath = path.join(process.cwd(), '.connections-backup.json');
    const connectionsJSON = JSON.stringify(
      connectionsManager.getAllConnections(),
      null, 
      2
    );
    await fs.writeFile(backupPath, connectionsJSON);
    
    console.log('✅ Connection state saved and backed up');
    console.log(`✅ Cleanup complete: ${closedCount} connections closed, ${errorCount} errors`);
    
    // Display next steps
    console.log('\n📋 Next steps:');
    console.log('1. Stop the agent if it\'s currently running');
    console.log('2. Delete the current .connections.json file to start fresh');
    console.log('3. Restart the agent to establish proper connection management');
    console.log('\n⚠️ Note: New connections will be properly managed by ConnectionsManager to prevent duplicates');
    
  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 