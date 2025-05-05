#!/usr/bin/env ts-node
/**
 * Moonscape Integration Test
 * This script sends a real message to Moonscape outbound channel
 */

// Import Hedera SDK
import { Client, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  console.log("🚀 Starting Moonscape Integration Test");
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID?.trim();
  const operatorKey = process.env.OPERATOR_KEY?.trim();
  const outboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC?.trim().replace(/"/g, '');
  
  if (!operatorId || !operatorKey || !outboundTopic) {
    console.error("❌ Missing required environment variables");
    console.log("NEXT_PUBLIC_OPERATOR_ID:", operatorId ? "Present" : "Missing");
    console.log("OPERATOR_KEY:", operatorKey ? "Present" : "Missing");
    console.log("NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:", outboundTopic ? outboundTopic : "Missing");
    process.exit(1);
  }
  
  console.log("✅ Environment variables verified");
  console.log("📨 Will send message to Moonscape outbound topic:", outboundTopic);
  
  try {
    // Create Hedera client
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Create test message
    const message = {
      id: `test-${Date.now()}`,
      type: "AgentMessage",
      timestamp: Date.now(),
      sender: "Lynxify Agent",
      details: {
        message: "This is a real test message sent directly to Moonscape",
        testTime: new Date().toISOString(),
        agentId: operatorId
      }
    };
    
    console.log("📝 Preparing message:", JSON.stringify(message, null, 2));
    
    // Convert to Buffer
    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    // Send to topic using Hedera SDK directly
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(outboundTopic)
      .setMessage(messageBuffer as unknown as string);
    
    console.log("🔄 Sending message to Hedera network...");
    const response = await transaction.execute(client) as any;
    
    // Get receipt
    const receipt = await response.getReceipt(client) as any;
    
    console.log("✅ Message sent successfully!");
    console.log("Status:", receipt.status ? receipt.status.toString() : "Unknown");
    console.log(`📊 View on Hashscan: https://hashscan.io/testnet/topic/${outboundTopic}`);
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

main().catch(err => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
}); 