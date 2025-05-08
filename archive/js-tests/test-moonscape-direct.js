#!/usr/bin/env node
/**
 * Direct Moonscape Integration Test
 * This script uses the raw format expected by Moonscape without any extra wrapper code
 */

// Import Hedera SDK directly
const { Client, TopicMessageSubmitTransaction } = require("@hashgraph/sdk");
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Check environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID?.trim();
const operatorKey = process.env.OPERATOR_KEY?.trim();
const outboundTopicRaw = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC?.trim();
const profileTopicRaw = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC?.trim();

// Remove any quotes from topic IDs
const outboundTopic = outboundTopicRaw?.replace(/['"]/g, '');
const profileTopic = profileTopicRaw?.replace(/['"]/g, '');

console.log(`🔍 DIRECT TEST: Using operator ID ${operatorId}`);
console.log(`🔍 DIRECT TEST: Raw outbound topic: ${outboundTopicRaw}`);
console.log(`🔍 DIRECT TEST: Cleaned outbound topic: ${outboundTopic}`);
console.log(`🔍 DIRECT TEST: Raw profile topic: ${profileTopicRaw}`);
console.log(`🔍 DIRECT TEST: Cleaned profile topic: ${profileTopic}`);

async function main() {
  if (!operatorId || !operatorKey || !outboundTopic) {
    console.error("❌ Missing required environment variables");
    process.exit(1);
  }
  
  try {
    // Initialize Hedera client directly
    console.log("🔄 Creating Hedera client...");
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Simple test message with minimal formatting
    const testMessage = {
      id: `test-${Date.now()}`,
      type: "AgentInfo",
      timestamp: Date.now(),
      sender: "Lynxify Direct Test",
      details: {
        message: "Direct test message to Moonscape",
        agentId: operatorId
      }
    };
    
    console.log(`📝 Sending raw message to topic: ${outboundTopic}`, JSON.stringify(testMessage, null, 2));
    
    // Convert to string and buffer directly
    const messageBuffer = Buffer.from(JSON.stringify(testMessage));
    
    // Create transaction with minimal wrapping
    console.log(`🔄 Creating transaction for topic ${outboundTopic}...`);
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(outboundTopic)
      .setMessage(messageBuffer);
    
    // Execute transaction
    console.log(`🔄 Executing transaction...`);
    const response = await transaction.execute(client);
    
    // Get transaction ID
    const txId = response.transactionId.toString();
    console.log(`🔍 Transaction ID: ${txId}`);
    console.log(`🔗 Verify on Hashscan: https://hashscan.io/testnet/transaction/${txId}`);
    
    // Try to get receipt
    console.log(`🔄 Getting receipt...`);
    try {
      const receipt = await response.getReceipt(client);
      console.log(`✅ Transaction successful!`);
      console.log(`📊 Receipt status: ${receipt.status.toString()}`);
    } catch (error) {
      console.error(`⚠️ Receipt error: ${error.message}`);
      console.log(`💡 Even with a receipt error, the message might still be delivered`);
    }
    
    // Profile update if available
    if (profileTopic) {
      await updateProfile(client, profileTopic, operatorId);
    }
    
    console.log(`\n📋 TEST COMPLETE: Check Hashscan links above to verify messages`);
    console.log(`🔗 Outbound topic: https://hashscan.io/testnet/topic/${outboundTopic}`);
    if (profileTopic) {
      console.log(`🔗 Profile topic: https://hashscan.io/testnet/topic/${profileTopic}`);
    }
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
  }
}

async function updateProfile(client, topicId, operatorId) {
  try {
    console.log(`\n🔄 Updating profile on topic: ${topicId}`);
    
    // Simple profile message
    const profileMessage = {
      id: `profile-${Date.now()}`,
      type: "AgentInfo",
      timestamp: Date.now(),
      sender: "Lynxify Direct Test",
      details: {
        message: "Direct profile update",
        agentId: operatorId,
        capabilities: ["rebalancing", "token_management"],
        agentDescription: "Lynxify direct integration test"
      }
    };
    
    console.log(`📝 Profile data:`, JSON.stringify(profileMessage, null, 2));
    
    // Convert to buffer
    const messageBuffer = Buffer.from(JSON.stringify(profileMessage));
    
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(messageBuffer);
    
    // Execute
    console.log(`🔄 Executing profile update...`);
    const response = await transaction.execute(client);
    
    // Get transaction ID
    const txId = response.transactionId.toString();
    console.log(`🔍 Profile Transaction ID: ${txId}`);
    console.log(`🔗 Verify on Hashscan: https://hashscan.io/testnet/transaction/${txId}`);
    
    // Try to get receipt
    try {
      const receipt = await response.getReceipt(client);
      console.log(`✅ Profile update successful!`);
      console.log(`📊 Receipt status: ${receipt.status.toString()}`);
    } catch (error) {
      console.error(`⚠️ Profile receipt error: ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ Profile update error: ${error.message}`);
  }
}

// Run the test
main().catch(err => {
  console.error(`❌ Unhandled error: ${err.message}`);
  process.exit(1);
}); 