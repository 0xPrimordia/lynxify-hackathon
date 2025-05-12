import { HCS10AgentHandler } from './hcs10/agent-handler.mjs';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main function to clear all connections
 */
async function main() {
  try {
    console.log('🔄 Initializing agent handler to clear all connections...');
    
    // Create and initialize agent handler
    const handler = new HCS10AgentHandler();
    await handler.initialize();
    
    // Get the connections file path
    const connectionsFile = path.join(process.cwd(), '.connections.json');
    
    // Backup the current connections file
    const backupFile = path.join(process.cwd(), `.connections.backup-${Date.now()}.json`);
    
    try {
      const data = await fs.readFile(connectionsFile, 'utf8');
      await fs.writeFile(backupFile, data);
      console.log(`✅ Backed up existing connections to ${backupFile}`);
    } catch (err) {
      console.log(`ℹ️ No existing connections file to backup`);
    }
    
    // Get all existing connections through the ConnectionsManager
    const connections = handler.connectionsManager.getAllConnections();
    console.log(`🔍 Found ${connections.length} connections to clear`);
    
    // Reset the connections in the ConnectionsManager
    handler.connections.clear();
    
    // Reset the ConnectionsManager connections
    // This is a bit of a hack since there's no official API to clear all connections
    if (handler.connectionsManager._connections) {
      handler.connectionsManager._connections = [];
    }
    
    // Write empty connections file
    await fs.writeFile(connectionsFile, JSON.stringify([]));
    console.log(`✅ Cleared connections file`);
    
    // If there's a pending connections file, clear it too
    try {
      const pendingConnectionsFile = path.join(process.cwd(), '.pending_connections.json');
      await fs.writeFile(pendingConnectionsFile, JSON.stringify([]));
      console.log(`✅ Cleared pending connections file`);
    } catch (err) {
      console.log(`ℹ️ No pending connections file to clear`);
    }
    
    console.log(`✅ All connections have been cleared!`);
    console.log(`📝 Note: Existing connection topics on Hedera may still exist,`);
    console.log(`   but they are no longer tracked by this agent.`);
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error clearing connections:`, error);
    process.exit(1);
  }
}

// Run the main function
main(); 