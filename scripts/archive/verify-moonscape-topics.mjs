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
    console.log(`   Auto-renew period: ${info.autoRenewPeriod?.seconds?.toNumber() || 'Not set'} seconds`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} topic ERROR: ${error.message}`);
    return false;
  }
}

async function verifyTopics() {
  try {
    console.log('🚀 Starting Moonscape topic verification...');
    
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
    
    // List of potential Moonscape registry topics to check
    const potentialRegistryTopics = [
      '0.0.5940171', // From last attempt
      '0.0.3963459', // Used by standards-agent-kit
      '0.0.3963458', // Another possible registry
      '0.0.5949504'  // Your original registry topic
    ];
    
    console.log('🔍 Checking potential Moonscape registry topics...');
    const validRegistryTopics = [];
    
    for (const topicId of potentialRegistryTopics) {
      const isValid = await checkTopic(client, topicId, `Potential registry`);
      if (isValid) {
        validRegistryTopics.push(topicId);
      }
    }
    
    // Check agent topics
    const inboundTopicId = '0.0.5964983';
    const outboundTopicId = '0.0.5964985';
    const profileTopicId = '0.0.5964987';
    
    const inboundValid = await checkTopic(client, inboundTopicId, 'Inbound');
    const outboundValid = await checkTopic(client, outboundTopicId, 'Outbound');
    const profileValid = await checkTopic(client, profileTopicId, 'Profile');
    
    console.log('\n==== Summary ====');
    console.log(`Found ${validRegistryTopics.length} valid registry topic(s): ${validRegistryTopics.join(', ') || 'None'}`);
    console.log(`Inbound topic: ${inboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Outbound topic: ${outboundValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Profile topic: ${profileValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (validRegistryTopics.length > 0) {
      console.log('\n🚀 NEXT STEPS:');
      console.log(`Run the registration script using one of the valid registry topics:`);
      validRegistryTopics.forEach(topic => {
        console.log(`node scripts/moonscape-registration.mjs ${topic}`);
      });
    } else {
      console.log('\n❌ No valid registry topics found. Check the Moonscape documentation for the correct registry topic ID.');
    }
    
  } catch (error) {
    console.error('❌ Error checking topics:', error);
    process.exit(1);
  }
}

// Additional parameter to specify registry topic ID from command line
const registryFromArgs = process.argv[2];
if (registryFromArgs) {
  console.log(`Using registry topic from command line: ${registryFromArgs}`);
}

// Run the verification
verifyTopics(); 