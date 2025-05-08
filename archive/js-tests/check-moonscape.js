// Check if we can access Moonscape topics
const { Client, TopicId, TopicInfoQuery } = require("@hashgraph/sdk");
require('dotenv').config({ path: '.env.local' });

async function checkTopic() {
  // Use hardcoded topic IDs to avoid any potential parsing issues
  const topics = [
    "0.0.5949493", // outbound
    "0.0.5949494", // inbound
    "0.0.5949512"  // profile
  ];
  
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  console.log(`Using operator: ${operatorId}`);
  
  // Create client
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  // Check each topic
  for (const topicStr of topics) {
    console.log(`\nChecking topic: ${topicStr}`);
    
    try {
      const topicId = TopicId.fromString(topicStr);
      
      // Query the topic info directly
      const query = new TopicInfoQuery()
        .setTopicId(topicId);
      
      console.log(`Executing info query...`);
      const info = await query.execute(client);
      
      console.log("✅ Topic exists and is accessible!");
      console.log(`📊 Topic Memo: ${info.topicMemo}`);
      console.log(`📊 Topic Admin Key?: ${info.adminKey !== null}`); 
      console.log(`📊 Topic Submit Key?: ${info.submitKey !== null}`);
      console.log(`📊 Topic Auto Renew Account: ${info.autoRenewAccountId?.toString() || "none"}`);
      
      // If there's a submit key, we need it to submit messages
      if (info.submitKey !== null) {
        console.log(`⚠️ This topic has a submit key requirement. We need the proper key to submit messages.`);
      } else {
        console.log(`✅ This topic does not require a submit key. Anyone can submit messages.`);
      }
    } catch (error) {
      console.error(`❌ Error checking topic ${topicStr}:`, error.message);
    }
    
    console.log(`🔗 View on Hashscan: https://hashscan.io/testnet/topic/${topicStr}`);
  }
}

checkTopic().catch(err => console.error("Unhandled error:", err)); 