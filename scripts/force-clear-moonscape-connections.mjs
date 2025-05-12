import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main function to force remove all connections from Moonscape
 */
async function main() {
  try {
    console.log('🔄 Initializing Moonscape connection remover...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    
    if (!operatorId || !operatorKey || !agentId) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY, NEXT_PUBLIC_HCS_AGENT_ID');
    }
    
    console.log(`🔄 Creating HCS10 client for agent ${agentId}...`);
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Initialize ConnectionsManager
    console.log('🔄 Initializing ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({ 
      baseClient: client 
    });
    console.log('✅ ConnectionsManager initialized');
    
    // Load connections from ConnectionsManager
    console.log('🔄 Fetching connection data...');
    const connections = await connectionsManager.fetchConnectionData(agentId);
    console.log(`✅ Found ${connections.length} connections`);
    
    // Get all connections including various statuses
    const allConnections = connectionsManager.getAllConnections();
    
    // Create backup files first
    await fs.writeFile(`.connections.backup-${Date.now()}.json`, JSON.stringify(allConnections, null, 2));
    console.log('✅ Created backup of connections data');
    
    // Process each connection for deletion
    let removedCount = 0;
    let failedCount = 0;
    
    for (const connection of allConnections) {
      try {
        console.log(`🔄 Removing connection: ${connection.connectionTopicId}`);
        
        // Use SDK to remove the connection - this sends removal request to Moonscape
        await client.removeConnection(connection.connectionTopicId);
        
        // Remove from local manager too
        connectionsManager.removeConnection(connection.connectionTopicId);
        
        console.log(`✅ Successfully removed connection: ${connection.connectionTopicId}`);
        removedCount++;
      } catch (error) {
        console.error(`❌ Failed to remove connection ${connection.connectionTopicId}:`, error.message);
        failedCount++;
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Clean up local storage files
    try {
      // Clear local connections file
      const connectionsFile = '.connections.json';
      await fs.writeFile(connectionsFile, '[]');
      console.log('✅ Cleared local connections file');
      
      // Clear pending connections file
      const pendingConnectionsFile = '.pending_connections.json';
      await fs.writeFile(pendingConnectionsFile, '[]');
      console.log('✅ Cleared pending connections file');
    } catch (error) {
      console.error('❌ Error clearing local files:', error.message);
    }
    
    console.log(`\n📊 Connection Removal Summary:
    - Total connections processed: ${allConnections.length}
    - Successfully removed: ${removedCount}
    - Failed to remove: ${failedCount}`);
    
    // For a completely fresh start, re-fetch connection data
    await connectionsManager.fetchConnectionData(agentId, true); // true forces cache refresh
    const remainingConnections = connectionsManager.getAllConnections();
    console.log(`✅ After cleanup: ${remainingConnections.length} connections remaining`);
    
  } catch (error) {
    console.error('❌ Error in connection remover:', error);
  }
}

// Run the main function
main().catch(console.error); 