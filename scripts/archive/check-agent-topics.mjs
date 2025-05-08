import dotenv from 'dotenv';
import { Client, AccountId, PrivateKey, TopicInfoQuery, TopicId } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkTopic(client, topicIdString, description) {
  console.log(`Checking ${description} topic: ${topicIdString}...`);
  try {
    const topicId = TopicId.fromString(topicIdString);
    const info = await new TopicInfoQuery()
      .setTopicId(topicId)
      .execute(client);
    
    console.log(`✅ ${description} topic FOUND:`);
    console.log(`   Topic ID: ${topicIdString}`);
    console.log(`   Memo: ${info.topicMemo}`);
    console.log(`   Admin key: ${info.adminKey ? 'Present' : 'None'}`);
    console.log(`   Submit key: ${info.submitKey ? 'Present' : 'None'}`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} topic ERROR: ${error.message}`);
    return false;
  }
}

async function verifyAgentTopics() {
  try {
    console.log('🚀 Verifying our agent\'s topics...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    // Create and configure Hedera client
    console.log('🔄 Creating Hedera client...');
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    console.log('✅ Hedera client created');
    
    // Check agent topics
    const inboundTopicId = '0.0.5964983';
    const outboundTopicId = '0.0.5964985';
    const profileTopicId = '0.0.5964987';
    
    const inboundValid = await checkTopic(client, inboundTopicId, 'Inbound');
    const outboundValid = await checkTopic(client, outboundTopicId, 'Outbound');
    const profileValid = await checkTopic(client, profileTopicId, 'Profile');
    
    console.log('\n==== Agent Topic Summary ====');
    console.log(`Inbound topic (0.0.5964983): ${inboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Outbound topic (0.0.5964985): ${outboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Profile topic (0.0.5964987): ${profileValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (inboundValid && outboundValid && profileValid) {
      console.log(`
=========================================================
✅ YOUR AGENT TOPICS ARE VALID AND READY FOR MOONSCAPE!

Use these details to manually register your agent:

- Account ID: ${operatorId}
- Inbound Topic: ${inboundTopicId}  
- Outbound Topic: ${outboundTopicId}
- Profile Topic: ${profileTopicId}

Go to the Moonscape interface and add these details manually
to their agent directory.
=========================================================
`);
    } else {
      console.log('\n❌ Some topics are invalid. You may need to recreate them.');
    }
    
  } catch (error) {
    console.error('❌ Error checking topics:', error);
    process.exit(1);
  }
}

// Run the verification
verifyAgentTopics(); 