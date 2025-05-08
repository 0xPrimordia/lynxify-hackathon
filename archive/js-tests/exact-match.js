const { Client, TopicMessageSubmitTransaction } = require("@hashgraph/sdk");
require('dotenv').config({ path: '.env.local' });

async function sendExactFormat() {
  const outboundTopic = "0.0.5949493";
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  // Create client
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  // EXACTLY match the format that worked
  const now = Date.now();
  const isoTime = new Date(now).toISOString();
  
  const message = {
    "id": `test-${now}`,
    "type": "AgentMessage",
    "timestamp": now,
    "sender": "Lynxify Agent",
    "details": {
      "message": "This is a real test message sent directly to Moonscape",
      "testTime": isoTime,
      "agentId": operatorId
    }
  };
  
  console.log(`Sending EXACT FORMAT message: ${JSON.stringify(message, null, 2)}`);
  
  // Create transaction
  const transaction = new TopicMessageSubmitTransaction()
    .setTopicId(outboundTopic)
    .setMessage(JSON.stringify(message));
  
  // Execute
  const response = await transaction.execute(client);
  const txId = response.transactionId.toString();
  console.log(`Transaction ID: ${txId}`);
  console.log(`Verify at: https://hashscan.io/testnet/transaction/${txId}`);
  
  // Get receipt to confirm success
  const receipt = await response.getReceipt(client);
  console.log(`Receipt status: ${receipt.status.toString()}`);
  console.log(`Sequence number: ${receipt.topicSequenceNumber?.toString() || "unknown"}`);
  
  console.log(`\nCheck topic directly: https://hashscan.io/testnet/topic/${outboundTopic}`);
}

sendExactFormat().catch(err => console.error("Error:", err)); 