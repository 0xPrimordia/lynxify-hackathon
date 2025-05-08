// Send a message and verify receipt
const { Client, TopicMessageSubmitTransaction, Status } = require("@hashgraph/sdk");
require('dotenv').config({ path: '.env.local' });

async function sendAndVerify() {
  const outboundTopic = "0.0.5949493";
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  console.log(`Using operator: ${operatorId}`);
  console.log(`Using topic: ${outboundTopic}`);
  
  // Create client
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  // Create message
  const message = {
    id: `verify-${Date.now()}`,
    type: "AgentInfo",
    timestamp: Date.now(),
    sender: "Verify Test",
    details: {
      message: "Message with receipt verification",
      agentId: operatorId
    }
  };
  
  console.log(`\nSending message: ${JSON.stringify(message)}`);
  
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(outboundTopic)
      .setMessage(JSON.stringify(message));
    
    // Execute transaction
    console.log("Executing transaction...");
    const response = await transaction.execute(client);
    
    // Get transaction ID
    const txId = response.transactionId.toString();
    console.log(`Transaction ID: ${txId}`);
    
    // Explicitly wait for receipt and check status
    console.log("Waiting for receipt (this proves message was accepted)...");
    const receipt = await response.getReceipt(client);
    
    console.log(`\n=== RECEIPT STATUS: ${receipt.status.toString()} ===`);
    
    if (receipt.status._code === Status.Success._code) {
      console.log("✅ TRANSACTION SUCCESSFUL - Message was accepted by the network");
      console.log(`✅ Topic sequence number: ${receipt.topicSequenceNumber?.toString() || "unknown"}`);
      console.log(`🔗 Check Hashscan (may take several minutes to appear): https://hashscan.io/testnet/topic/${outboundTopic}`);
    } else {
      console.log(`❌ TRANSACTION FAILED - Status code: ${receipt.status._code}`);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    if (error.name === "ReceiptStatusError") {
      console.error(`❌ Receipt status: ${error.status?._code || "unknown"}`);
      console.error("This means the transaction was submitted but rejected by the network");
    }
  }
}

sendAndVerify().catch(err => console.error("Unhandled error:", err)); 