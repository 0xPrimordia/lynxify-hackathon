// Absolute bare-minimum test
const { Client, TopicMessageSubmitTransaction } = require("@hashgraph/sdk");
require('dotenv').config({ path: '.env.local' });

async function simpleTest() {
  // Clean topic IDs (remove any quotes)
  const outboundTopic = "0.0.5949493";
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  console.log(`Using operator: ${operatorId}`);
  console.log(`Using topic: ${outboundTopic}`);
  
  // Create client
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  // Prepare message
  const message = {
    id: `msg-${Date.now()}`,
    type: "AgentInfo",
    timestamp: Date.now(),
    sender: "Simple Test",
    details: {
      message: "Simplest possible test message",
      testId: Date.now().toString(),
      agentId: operatorId
    }
  };
  
  console.log("Sending message:", JSON.stringify(message, null, 2));
  
  // Create transaction
  const transaction = new TopicMessageSubmitTransaction()
    .setTopicId(outboundTopic)
    .setMessage(JSON.stringify(message));
  
  // Execute
  const response = await transaction.execute(client);
  const txId = response.transactionId.toString();
  console.log(`Transaction ID: ${txId}`);
  console.log(`Verify at: https://hashscan.io/testnet/transaction/${txId}`);
  
  // Wait and then check Hashscan to verify
  console.log(`Check topic at: https://hashscan.io/testnet/topic/${outboundTopic}`);
}

simpleTest().catch(err => console.error("Error:", err)); 