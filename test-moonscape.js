#!/usr/bin/env node
/**
 * Moonscape Integration Test
 * This script sends a real message to Moonscape outbound channel
 */

// Import Hedera SDK
const { Client, TopicMessageSubmitTransaction } = require("@hashgraph/sdk");
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  console.log("🚀 Starting Moonscape Integration Test");
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID?.trim();
  const operatorKey = process.env.OPERATOR_KEY?.trim();
  const outboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC?.trim().replace(/"/g, '');
  const profileTopic = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC?.trim().replace(/"/g, '');
  
  if (!operatorId || !operatorKey || !outboundTopic) {
    console.error("❌ Missing required environment variables");
    console.log("NEXT_PUBLIC_OPERATOR_ID:", operatorId ? "Present" : "Missing");
    console.log("OPERATOR_KEY:", operatorKey ? "Present" : "Missing");
    console.log("NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:", outboundTopic ? outboundTopic : "Missing");
    console.log("NEXT_PUBLIC_HCS_PROFILE_TOPIC:", profileTopic ? profileTopic : "Missing");
    process.exit(1);
  }
  
  console.log("✅ Environment variables verified");
  console.log("📨 Will send message to Moonscape outbound topic:", outboundTopic);
  
  try {
    // Create Hedera client
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Send multiple message types
    await sendAgentInfo(client, outboundTopic, operatorId);
    await sendAgentRequest(client, outboundTopic, operatorId);
    
    // If profile topic is available, send profile update
    if (profileTopic) {
      await sendProfileUpdate(client, profileTopic, operatorId);
    }
    
    console.log("✅ All test messages sent successfully!");
    console.log(`📊 View outbound messages on Hashscan: https://hashscan.io/testnet/topic/${outboundTopic}`);
    if (profileTopic) {
      console.log(`📊 View profile messages on Hashscan: https://hashscan.io/testnet/topic/${profileTopic}`);
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

async function sendAgentInfo(client, topicId, operatorId) {
  // Create test message
  const message = {
    id: `info-${Date.now()}`,
    type: "AgentInfo",
    timestamp: Date.now(),
    sender: "Lynxify Agent",
    details: {
      message: "Rebalancer Agent is active and ready to process requests",
      rebalancerStatus: "active",
      agentId: operatorId
    }
  };
  
  console.log("📝 Sending AgentInfo message:", JSON.stringify(message, null, 2));
  
  // Send to topic
  await sendMessage(client, topicId, message);
}

async function sendAgentRequest(client, topicId, operatorId) {
  // Create test message
  const message = {
    id: `request-${Date.now()}`,
    type: "AgentRequest",
    timestamp: Date.now(),
    sender: "Lynxify Agent",
    details: {
      message: "Test request for the rebalancer agent",
      request: "status",
      agentId: operatorId
    }
  };
  
  console.log("📝 Sending AgentRequest message:", JSON.stringify(message, null, 2));
  
  // Send to topic
  await sendMessage(client, topicId, message);
}

async function sendProfileUpdate(client, topicId, operatorId) {
  // Create profile message
  const message = {
    id: `profile-${Date.now()}`,
    type: "AgentInfo",
    timestamp: Date.now(),
    sender: "Lynxify Agent",
    details: {
      message: "Rebalancer Agent profile update",
      agentId: operatorId,
      agentDescription: "AI-powered rebalancing agent for tokenized index",
      capabilities: ["rebalancing", "market_analysis", "token_management"],
      rebalancerStatus: "active"
    }
  };
  
  console.log("📝 Sending Profile update message:", JSON.stringify(message, null, 2));
  
  // Send to topic
  await sendMessage(client, topicId, message);
}

async function sendMessage(client, topicId, message) {
  // Convert to Buffer
  const messageBuffer = Buffer.from(JSON.stringify(message));
  
  // Send to topic using Hedera SDK directly
  const transaction = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(messageBuffer);
  
  console.log(`🔄 Sending message to topic ${topicId}...`);
  const response = await transaction.execute(client);
  
  // Get receipt
  const receipt = await response.getReceipt(client);
  
  console.log(`✅ Message sent successfully to topic ${topicId}`);
}

main().catch(err => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
}); 