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
    console.log(`   Auto-renew period: ${info.autoRenewPeriod.seconds.toNumber()} seconds`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} topic ERROR: ${error.message}`);
    return false;
  }
}

async function checkTopics() {
  try {
    console.log('🚀 Starting topic verification...');
    
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
    
    // Check registry topic
    const registryTopicId = '0.0.5940171';
    const registryValid = await checkTopic(client, registryTopicId, 'Registry');
    
    // Check agent topics
    const inboundTopicId = '0.0.5964983';
    const outboundTopicId = '0.0.5964985';
    const profileTopicId = '0.0.5964987';
    
    const inboundValid = await checkTopic(client, inboundTopicId, 'Inbound');
    const outboundValid = await checkTopic(client, outboundTopicId, 'Outbound');
    const profileValid = await checkTopic(client, profileTopicId, 'Profile');
    
    console.log('\n==== Summary ====');
    console.log(`Registry topic: ${registryValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Inbound topic: ${inboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Outbound topic: ${outboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Profile topic: ${profileValid ? '✅ Valid' : '❌ Invalid'}`);
    
  } catch (error) {
    console.error('❌ Error checking topics:', error);
    process.exit(1);
  }
}

// Run the check
checkTopics(); 