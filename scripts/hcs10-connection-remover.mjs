import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt for confirmation before deleting connections
 */
function confirmAction(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main function to remove all connections
 */
async function main() {
  try {
    console.log('🔄 Initializing connection remover...');
    
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
    const activeConnections = connectionsManager.getActiveConnections();
    const pendingConnections = connectionsManager.getPendingRequests();
    const needsConfirmationConnections = connectionsManager.getConnectionsNeedingConfirmation();
    
    console.log(`📊 Connection Statistics:
    - Total connections: ${allConnections.length}
    - Active connections: ${activeConnections.length}
    - Pending connections: ${pendingConnections.length}
    - Needs confirmation: ${needsConfirmationConnections.length}`);
    
    // Show a sample of connections
    if (allConnections.length > 0) {
      console.log('\n📝 Sample of connections:');
      const sampleSize = Math.min(5, allConnections.length);
      for (let i = 0; i < sampleSize; i++) {
        const conn = allConnections[i];
        console.log(`  - ID: ${conn.connectionTopicId}, Status: ${conn.status}, Target: ${conn.targetAccountId}`);
      }
    }
    
    // Ask for confirmation before proceeding with deletion
    const shouldProceed = await confirmAction('\n⚠️ WARNING: This will remove ALL connections. Are you sure you want to proceed?');
    
    if (!shouldProceed) {
      console.log('❌ Operation cancelled by user.');
      rl.close();
      return;
    }
    
    // If confirmed, proceed with deletion
    console.log('🔄 Proceeding to remove connections...');
    
    // Create backup files first
    await fs.writeFile(`.connections.backup-${Date.now()}.json`, JSON.stringify(allConnections, null, 2));
    console.log('✅ Created backup of connections data');
    
    // Process each connection for deletion
    let removedCount = 0;
    let failedCount = 0;
    
    for (const connection of allConnections) {
      try {
        console.log(`🔄 Removing connection: ${connection.connectionTopicId}`);
        
        // Use SDK to remove the connection
        await client.removeConnection(connection.connectionTopicId);
        
        // Mark as removed in the ConnectionsManager
        connectionsManager.removeConnection(connection.connectionTopicId);
        
        console.log(`✅ Successfully removed connection: ${connection.connectionTopicId}`);
        removedCount++;
      } catch (error) {
        console.error(`❌ Failed to remove connection ${connection.connectionTopicId}:`, error.message);
        failedCount++;
      }
    }
    
    // Clean up local storage files
    try {
      // Try to clean up the local connections file
      const connectionsFile = '.connections.json';
      await fs.writeFile(connectionsFile, '[]');
      console.log('✅ Cleared local connections file');
      
      // Try to clean up pending connections file
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
    
    if (failedCount > 0) {
      console.log('⚠️ Some connections could not be removed. You may need to handle them manually.');
    } else {
      console.log('✅ All connections have been successfully removed!');
    }
    
  } catch (error) {
    console.error('❌ Error in connection remover:', error);
  } finally {
    rl.close();
  }
}

// Run the main function
main().catch(console.error); 