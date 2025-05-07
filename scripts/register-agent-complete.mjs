#!/usr/bin/env node

/**
 * Complete Agent Registration & Profile Script for Moonscape
 * 
 * This script performs the full process:
 * 1. Creates necessary topics
 * 2. Registers the agent with Moonscape
 * 3. Publishes the agent profile to make it visible
 * 4. Stores all correct topic IDs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile } from 'fs/promises';
import { 
  Client, 
  PrivateKey, 
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageSubmitTransaction, 
  TopicId 
} from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Constants
const MOONSCAPE_REGISTRY_TOPIC_ID = "0.0.5949504"; // Moonscape public HCS-10 registry topic
const REGISTRATION_STATUS_FILE = join(process.cwd(), '.registration_status.json');

// Color codes for console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

// Main function
async function main() {
  console.log(`${colors.magenta}=====================================${colors.reset}`);
  console.log(`${colors.magenta}Lynxify Complete Agent Registration${colors.reset}`);
  console.log(`${colors.magenta}=====================================${colors.reset}`);
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    console.error(`${colors.red}❌ Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.blue}ℹ️ Using account: ${operatorId}${colors.reset}`);
  console.log(`${colors.blue}ℹ️ Using Moonscape registry topic: ${MOONSCAPE_REGISTRY_TOPIC_ID}${colors.reset}`);
  
  try {
    // Initialize Hedera client
    console.log(`\n${colors.blue}🔄 Initializing Hedera client...${colors.reset}`);
    const client = Client.forTestnet();
    client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
    console.log(`${colors.green}✅ Client initialized successfully${colors.reset}`);
    
    // Skip registry topic verification since it might not be directly accessible
    console.log(`\n${colors.yellow}⚠️ Skipping registry topic verification...${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Using registry topic from environment: ${MOONSCAPE_REGISTRY_TOPIC_ID}${colors.reset}`);
    
    // Create inbound & outbound topics
    console.log(`\n${colors.blue}🔄 Creating inbound topic...${colors.reset}`);
    const inboundTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Inbound Topic")
      .execute(client);
    
    const inboundTopicReceipt = await inboundTopicTx.getReceipt(client);
    const inboundTopicId = inboundTopicReceipt.topicId.toString();
    console.log(`${colors.green}✅ Inbound topic created: ${inboundTopicId}${colors.reset}`);
    
    console.log(`\n${colors.blue}🔄 Creating outbound topic...${colors.reset}`);
    const outboundTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Outbound Topic")
      .execute(client);
    
    const outboundTopicReceipt = await outboundTopicTx.getReceipt(client);
    const outboundTopicId = outboundTopicReceipt.topicId.toString();
    console.log(`${colors.green}✅ Outbound topic created: ${outboundTopicId}${colors.reset}`);
    
    // Create agent registration message
    console.log(`\n${colors.blue}🔄 Preparing agent registration message...${colors.reset}`);
    const registrationMessage = {
      p: "hcs-10",
      op: "register",
      account_id: operatorId,
      inbound_topic: inboundTopicId,
      outbound_topic: outboundTopicId,
      timestamp: Date.now()
    };
    
    console.log(JSON.stringify(registrationMessage, null, 2));
    
    // Submit registration to Moonscape registry
    console.log(`\n${colors.blue}🔄 Submitting registration to Moonscape registry...${colors.reset}`);
    const registrationTx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(MOONSCAPE_REGISTRY_TOPIC_ID))
      .setMessage(JSON.stringify(registrationMessage))
      .execute(client);
    
    const registrationReceipt = await registrationTx.getReceipt(client);
    console.log(`${colors.green}✅ Registration submitted successfully${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Transaction ID: ${registrationTx.transactionId.toString()}${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Sequence Number: ${registrationReceipt.topicSequenceNumber.toString()}${colors.reset}`);
    
    // Create agent profile
    console.log(`\n${colors.blue}🔄 Creating agent profile...${colors.reset}`);
    const agentProfile = {
      p: "hcs-10",
      op: "profile",
      agent_id: operatorId,
      inbound_topic: inboundTopicId,
      outbound_topic: outboundTopicId,
      name: "Lynxify Tokenized Index Agent",
      description: "An agent for managing tokenized index operations and rebalancing",
      version: "1.0.0",
      capabilities: ["rebalance", "tokenized-index", "governance"],
      timestamp: Date.now()
    };
    
    console.log(JSON.stringify(agentProfile, null, 2));
    
    // Publish profile to registry
    console.log(`\n${colors.blue}🔄 Publishing profile to registry...${colors.reset}`);
    const profileTx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(MOONSCAPE_REGISTRY_TOPIC_ID))
      .setMessage(JSON.stringify(agentProfile))
      .execute(client);
    
    const profileReceipt = await profileTx.getReceipt(client);
    console.log(`${colors.green}✅ Profile published successfully${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Transaction ID: ${profileTx.transactionId.toString()}${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Sequence Number: ${profileReceipt.topicSequenceNumber.toString()}${colors.reset}`);
    
    // Save registration info
    const registrationInfo = {
      accountId: operatorId,
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId,
      registryTopic: MOONSCAPE_REGISTRY_TOPIC_ID,
      registrationTimestamp: registrationMessage.timestamp,
      profileTimestamp: agentProfile.timestamp,
      registrationTxId: registrationTx.transactionId.toString(),
      profileTxId: profileTx.transactionId.toString(),
      created: new Date().toISOString()
    };
    
    await writeFile(REGISTRATION_STATUS_FILE, JSON.stringify(registrationInfo, null, 2));
    console.log(`\n${colors.green}✅ Registration information saved to ${REGISTRATION_STATUS_FILE}${colors.reset}`);
    
    // Success message with verification links
    console.log(`\n${colors.green}🎉 REGISTRATION COMPLETE!${colors.reset}`);
    console.log(`${colors.green}Your agent is now registered and published to Moonscape.${colors.reset}`);
    console.log(`\n${colors.cyan}📊 Verify on Hashscan:${colors.reset}`);
    console.log(`${colors.cyan}  Agent Account: https://hashscan.io/testnet/account/${operatorId}${colors.reset}`);
    console.log(`${colors.cyan}  Inbound Topic: https://hashscan.io/testnet/topic/${inboundTopicId}${colors.reset}`);
    console.log(`${colors.cyan}  Outbound Topic: https://hashscan.io/testnet/topic/${outboundTopicId}${colors.reset}`);
    console.log(`${colors.cyan}  Registry Topic: https://hashscan.io/testnet/topic/${MOONSCAPE_REGISTRY_TOPIC_ID}${colors.reset}`);
    console.log(`${colors.cyan}  Registration Tx: https://hashscan.io/testnet/transaction/${registrationTx.transactionId.toString()}${colors.reset}`);
    console.log(`${colors.cyan}  Profile Tx: https://hashscan.io/testnet/transaction/${profileTx.transactionId.toString()}${colors.reset}`);
    
    console.log(`\n${colors.green}✅ You can now connect to your agent on Moonscape:${colors.reset}`);
    console.log(`${colors.green}   https://moonscape.tech/openconvai${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}❌ Error during registration process: ${error.message}${colors.reset}`);
    if (error.stack) console.error(`${colors.red}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(`\n${colors.red}❌ Unhandled error: ${error.message}${colors.reset}`);
  if (error.stack) console.error(`${colors.red}${error.stack}${colors.reset}`);
  process.exit(1);
}); 