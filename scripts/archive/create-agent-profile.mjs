import dotenv from 'dotenv';
import { Client, AccountId, PrivateKey, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createAgentProfile() {
  try {
    console.log('🚀 Creating agent profile...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    // Your agent topic IDs - replace with your actual topic IDs
    const inboundTopicId = '0.0.5964983';
    const outboundTopicId = '0.0.5964985';
    const profileTopicId = '0.0.5964987';
    
    // Create and configure Hedera client
    console.log('🔄 Creating Hedera client...');
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    console.log('✅ Hedera client created');
    
    // Create profile in HCS-11 format
    console.log('🔄 Creating profile message...');
    
    const agentProfile = {
      version: "1.0",
      type: 1, // AI Agent type
      display_name: "Lynxify Tokenized Index Agent",
      alias: "lynxify_agent",
      bio: "Manages tokenized index rebalancing and executes approved proposals",
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId,
      properties: {
        description: "Rebalancer for Lynxify Tokenized Index",
        version: "1.0.0",
        creator: "Lynxify"
      },
      aiAgent: {
        type: 0, // General purpose agent
        capabilities: [0, 1], // Basic capabilities
        creator: "Lynxify"
      }
    };
    
    console.log('📝 Agent profile:', JSON.stringify(agentProfile, null, 2));
    
    // Submit profile to the profile topic
    console.log(`🔄 Submitting profile to profile topic ${profileTopicId}...`);
    const submitTx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(profileTopicId))
      .setMessage(JSON.stringify(agentProfile));
      
    const submitResponse = await submitTx.execute(client);
    const receipt = await submitResponse.getReceipt(client);
    
    console.log('✅ Profile message submitted successfully!');
    console.log('Receipt status:', receipt.status.toString());
    
    console.log(`
    ======================================================
    ✅ Agent profile created successfully!
    
    PROFILE TOPIC ID: ${profileTopicId}
    PROFILE MESSAGE SEQUENCE: ${receipt.topicSequenceNumber?.toString() || 'Unknown'}
    
    Your agent profile is now published to the profile topic.
    ======================================================
    `);
    
  } catch (error) {
    console.error('❌ Error creating agent profile:', error);
    process.exit(1);
  }
}

// Run the script
createAgentProfile(); 