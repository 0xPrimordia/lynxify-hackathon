import { HCS10AgentHandler } from './hcs10/agent-handler.mjs';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main function to approve all pending connections
 */
async function main() {
  try {
    console.log('🔄 Initializing agent handler to approve all pending connections...');
    
    // Create and initialize agent handler
    const handler = new HCS10AgentHandler();
    await handler.initialize();
    
    // Load connections file
    const connectionsFile = path.join(process.cwd(), '.connections.json');
    const data = await fs.readFile(connectionsFile, 'utf8');
    const connections = JSON.parse(data);
    
    // Find pending connections (status = needs_confirmation)
    const pendingConnections = connections.filter(conn => 
      conn.status === 'needs_confirmation'
    );
    
    console.log(`🔍 Found ${pendingConnections.length} pending connections`);
    
    if (pendingConnections.length === 0) {
      console.log('✅ No pending connections to approve!');
      process.exit(0);
    }
    
    // Approve each connection
    let approved = 0;
    let failed = 0;
    
    for (const conn of pendingConnections) {
      try {
        console.log(`🔄 Approving connection: ${conn.id}`);
        const result = await handler.manuallyApproveConnection(conn.id);
        
        if (result) {
          console.log(`✅ Connection approved successfully: ${conn.id}`);
          console.log(`   Connection topic: ${result.connectionTopicId}`);
          approved++;
        } else {
          console.log(`⚠️ Connection could not be approved: ${conn.id}`);
          failed++;
        }
      } catch (error) {
        console.error(`❌ Error approving connection ${conn.id}:`, error.message);
        failed++;
      }
      
      // Small delay between approvals to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Results: ${approved} connections approved, ${failed} failed`);
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error in main function:`, error);
    process.exit(1);
  }
}

// Run the main function
main(); 