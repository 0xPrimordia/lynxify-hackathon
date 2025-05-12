import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables');
    }
    
    // Create HCS10 client directly from standards documentation approach
    console.log('Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey
    });
    
    // Get agent ID for the profile
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    if (!agentId) {
      throw new Error('Missing NEXT_PUBLIC_HCS_AGENT_ID');
    }
    
    // Get the profile - pure SDK approach
    console.log(`Getting profile for agent ${agentId}...`);
    const profile = await client.getProfile(agentId);
    console.log('Profile:', profile);
    
    // Get all connections
    console.log('Getting connections...');
    const connections = await client.getConnections(agentId);
    console.log(`Found ${connections.length} connections`);
    
    // Process each connection
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      const connectionTopicId = connection.connectionTopicId || connection.id;
      
      if (!connectionTopicId) {
        console.log(`Connection ${i} has no topic ID, skipping`);
        failureCount++;
        continue;
      }
      
      try {
        console.log(`Removing connection ${i+1}/${connections.length}: ${connectionTopicId}`);
        // Use the direct SDK method to remove connection
        await client.removeConnection(connectionTopicId);
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
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 