import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main function to forcefully clear all connections
 */
async function main() {
  try {
    console.log('🔄 Force clearing all connections...');
    
    // Get file paths
    const connectionsFile = path.join(process.cwd(), '.connections.json');
    const pendingConnectionsFile = path.join(process.cwd(), '.pending_connections.json');
    const backupFile = path.join(process.cwd(), `.connections.backup-${Date.now()}.json`);
    
    try {
      // Backup current connections first
      const data = await fs.readFile(connectionsFile, 'utf8');
      await fs.writeFile(backupFile, data);
      console.log(`✅ Backed up existing connections to ${backupFile}`);
    } catch (err) {
      console.log(`ℹ️ No existing connections file to backup`);
    }
    
    // Direct file write approach - bypass ConnectionsManager entirely
    await fs.writeFile(connectionsFile, '[]');
    console.log(`✅ Force cleared connections file`);
    
    try {
      await fs.writeFile(pendingConnectionsFile, '[]');
      console.log(`✅ Force cleared pending connections file`);
    } catch (err) {
      console.log(`ℹ️ No pending connections file to clear`);
    }
    
    console.log(`🔄 Checking for any other connection files...`);
    
    // Look for any other connection-related files
    const files = await fs.readdir(process.cwd());
    for (const file of files) {
      if (file.includes('connection') && file.endsWith('.json')) {
        if (file !== path.basename(connectionsFile) && file !== path.basename(pendingConnectionsFile)) {
          console.log(`🔍 Found additional connection file: ${file}`);
          try {
            await fs.writeFile(path.join(process.cwd(), file), '[]');
            console.log(`✅ Cleared ${file}`);
          } catch (err) {
            console.error(`❌ Error clearing ${file}:`, err);
          }
        }
      }
    }
    
    console.log(`✅ All connection files have been forcefully cleared!`);
    console.log(`📝 Please restart your agent service for changes to take effect.`);
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error force clearing connections:`, error);
    process.exit(1);
  }
}

// Run the main function
main(); 