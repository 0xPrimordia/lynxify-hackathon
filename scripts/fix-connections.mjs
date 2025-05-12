#!/usr/bin/env node

import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
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
 * Main function to fix connections
 */
async function main() {
  try {
    console.log('🔧 Starting connection fix based on standards-expert example...');

    // Create HCS10 client with proper credentials
    console.log(`🔄 Creating HCS10Client for agent ${agentId}...`);
    const client = new HCS10Client({
      network: process.env.HEDERA_NETWORK || 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });

    // Create ConnectionsManager following the standards-expert example
    console.log('🔄 Creating ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      baseClient: client
    });

    // Backup existing connections file
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const backupPath = `${CONNECTIONS_FILE}.backup-${Date.now()}`;
      fs.copyFileSync(CONNECTIONS_FILE, backupPath);
      console.log(`📦 Created backup of connections file at ${backupPath}`);
    }

    // Fetch connections data using ConnectionsManager to get the source of truth
    console.log('🔄 Fetching connection data from Hedera using ConnectionsManager...');
    await connectionsManager.fetchConnectionData(agentId, true); // Force refresh

    // Get all connections from the manager 
    const managerConnections = connectionsManager.getAllConnections();
    console.log(`📊 Found ${managerConnections.length} connections in ConnectionsManager`);

    // Convert to the format needed for storage
    const connectionsToStore = managerConnections.map(conn => ({
      id: conn.connectionTopicId,
      connectionTopicId: conn.connectionTopicId,
      requesterId: conn.targetAccountId,
      status: conn.status || 'established',
      timestamp: conn.created?.getTime() || Date.now()
    }));

    // Save connections to file in the proper format
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connectionsToStore, null, 2));
    console.log(`✅ Saved ${connectionsToStore.length} connections to ${CONNECTIONS_FILE}`);
    
    // Output the fixed connections
    console.log('📊 Connection Summary:');
    const statusCounts = {};
    managerConnections.forEach(conn => {
      statusCounts[conn.status || 'unknown'] = (statusCounts[conn.status || 'unknown'] || 0) + 1;
    });
    
    console.log(statusCounts);
    
    console.log('✅ Connection fix complete!');
    
  } catch (error) {
    console.error('❌ Error fixing connections:', error);
    process.exit(1);
  }
}

main(); 