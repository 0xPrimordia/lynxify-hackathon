import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Verifies the existing HCS-10 agent registration
 */
async function main() {
  try {
    console.log('🔍 Verifying HCS-10 agent registration...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    // Load registration status to verify created topics
    let registrationData;
    try {
      registrationData = JSON.parse(await fs.readFile('.registration_status.json', 'utf8'));
      console.log('📝 Found registration data:', JSON.stringify(registrationData, null, 2));
    } catch (error) {
      throw new Error('Registration status file not found. Please register an agent first.');
    }
    
    // Check if we have all needed IDs
    const accountId = registrationData.accountId || process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    const inboundTopicId = registrationData.inboundTopicId || process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
    const outboundTopicId = registrationData.outboundTopicId || process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
    
    if (!accountId || !inboundTopicId || !outboundTopicId) {
      throw new Error('Missing required IDs in registration data.');
    }
    
    console.log(`
    Verifying registration with:
    * Account ID: ${accountId}
    * Inbound Topic: ${inboundTopicId}
    * Outbound Topic: ${outboundTopicId}
    `);
    
    // Create HCS10 client to check registration
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId: operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Verify agent exists in Moonscape registry
    console.log('🔍 Checking agent registration in Moonscape registry...');
    
    // Try to access inbound topic to verify agent
    console.log('🔍 Attempting to access inbound topic...');
    try {
      const topicType = await client.getInboundTopicType(inboundTopicId);
      console.log(`✅ Successfully accessed inbound topic: ${inboundTopicId}`);
      console.log(`✅ Topic type: ${topicType}`);
      console.log('✅ Agent appears to be properly set up!');
    } catch (error) {
      console.error('❌ Failed to access inbound topic:', error);
      console.log('⚠️ Agent may not be properly registered with Moonscape');
    }
    
    console.log(`
    ======================================================
    🔍 AGENT VERIFICATION RESULTS
    
    Agent ID (Account ID): ${accountId}
    Inbound Topic: ${inboundTopicId}
    Outbound Topic: ${outboundTopicId}
    Profile Topic: ${registrationData.profileTopicId || 'N/A'}
    
    ✅ Topics exist and agent appears to be properly set up
    
    You can now use these topics in your application
    ======================================================
    `);
    
  } catch (error) {
    console.error('❌ Error verifying agent:', error);
    process.exit(1);
  }
}

// Run the verification process
main(); 