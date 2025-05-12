import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    
    if (!operatorId || !operatorKey || !agentId) {
      throw new Error('Missing required environment variables');
    }
    
    console.log(`Creating HCS10 client for agent ${agentId}...`);
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey
    });
    
    // Create ConnectionsManager - this is correct per SDK implementation
    console.log('Creating ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      baseClient: client
    });
    
    // Fetch connections data using ConnectionsManager
    console.log('Fetching connection data...');
    await connectionsManager.fetchConnectionData(agentId);
    
    // Get active connections
    const connections = connectionsManager.getAllConnections();
    console.log(`Found ${connections.length} connections`);
    
    // Log some connection data for debugging
    if (connections.length > 0) {
      console.log('Sample connection:', JSON.stringify(connections[0], null, 2));
    }
    
    // Process each connection
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      const connectionTopicId = connection.connectionTopicId;
      
      if (!connectionTopicId) {
        console.log(`Connection ${i} has no topic ID, skipping`);
        failureCount++;
        continue;
      }
      
      try {
        console.log(`Removing connection ${i+1}/${connections.length}: ${connectionTopicId}`);
        
        // Remove the connection using client
        await client.removeConnection(connectionTopicId);
        
        // Also remove from ConnectionsManager
        connectionsManager.removeConnection(connectionTopicId);
        
        console.log(`Successfully removed connection: ${connectionTopicId}`);
        successCount++;
      } catch (error) {
        console.error(`Failed to remove connection ${connectionTopicId}:`, error.message);
        failureCount++;
      }
      
      // Small delay to avoid overwhelming the network
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nConnection Cleanup Summary:
    - Total connections: ${connections.length}
    - Successfully removed: ${successCount}
    - Failed: ${failureCount}`);
    
    // Re-fetch data to confirm status
    await connectionsManager.fetchConnectionData(agentId, true); // force refresh
    const remainingConnections = connectionsManager.getAllConnections();
    console.log(`Remaining connections after cleanup: ${remainingConnections.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 