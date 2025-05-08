import dotenv from 'dotenv';
import { Client, AccountId, PrivateKey, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function registerAgent(registryTopicId) {
  if (!registryTopicId) {
    console.error('❌ Error: Registry topic ID is required');
    console.log('Usage: node scripts/register-agent.mjs <registryTopicId>');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting agent registration with Moonscape registry...');
    
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
    
    // Create registration message in HCS-10 format
    console.log('🔄 Creating registration message...');
    
    const registrationMessage = {
      p: "hcs-10",
      op: "register",
      account_id: operatorId,
      profile: {
        topicId: profileTopicId
      },
      messaging: {
        inboundTopicId: inboundTopicId,
        outboundTopicId: outboundTopicId
      },
      m: "Lynxify Tokenized Index Agent - HCS-10 registration"
    };
    
    console.log('📝 Registration message:', JSON.stringify(registrationMessage, null, 2));
    console.log(`🔍 Target Registry Topic: ${registryTopicId}`);
    
    // Submit registration message to Moonscape registry
    console.log(`🔄 Submitting registration to HCS-10 registry topic ${registryTopicId}...`);
    const submitTx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(registryTopicId))
      .setMessage(JSON.stringify(registrationMessage));
      
    const submitResponse = await submitTx.execute(client);
    const receipt = await submitResponse.getReceipt(client);
    
    console.log('✅ Registration message submitted successfully!');
    console.log('Transaction ID:', submitResponse.transactionId.toString());
    console.log('Receipt status:', receipt.status.toString());
    
    console.log(`
    ======================================================
    ✅ Agent successfully registered with Moonscape!
    
    ACCOUNT ID: ${operatorId}
    INBOUND TOPIC: ${inboundTopicId}
    OUTBOUND TOPIC: ${outboundTopicId}
    PROFILE TOPIC: ${profileTopicId}
    REGISTRY TOPIC: ${registryTopicId}
    REGISTRY MESSAGE SEQUENCE: ${receipt.topicSequenceNumber?.toString() || 'Unknown'}
    
    The agent should now be visible in the Moonscape interface.
    ======================================================
    `);
    
  } catch (error) {
    console.error('❌ Error registering agent:', error);
    process.exit(1);
  }
}

// Get registry topic ID from command line
const registryTopicId = process.argv[2];

// Run the registration
registerAgent(registryTopicId); 