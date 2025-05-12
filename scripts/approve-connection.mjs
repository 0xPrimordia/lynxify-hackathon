import { HCS10AgentHandler } from './hcs10/agent-handler.mjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main function to approve a connection
 */
async function main() {
  try {
    // Get the connection ID from command line
    const connectionId = process.argv[2];
    
    if (!connectionId) {
      console.error('❌ Error: Please provide a connection ID as an argument');
      console.log('Usage: node scripts/approve-connection.mjs <connectionId>');
      process.exit(1);
    }
    
    console.log(`🔄 Initializing agent handler to approve connection: ${connectionId}`);
    
    // Create and initialize agent handler
    const handler = new HCS10AgentHandler();
    await handler.initialize();
    
    // Approve the connection
    console.log(`🔄 Approving connection: ${connectionId}`);
    const result = await handler.manuallyApproveConnection(connectionId);
    
    if (result) {
      console.log(`✅ Connection approved successfully!`);
      console.log(`   Connection topic: ${result.connectionTopicId}`);
    } else {
      console.log(`⚠️ Connection could not be approved`);
    }
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error approving connection:`, error);
    process.exit(1);
  }
}

// Run the main function
main(); 