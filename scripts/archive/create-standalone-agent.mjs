#!/usr/bin/env node

/**
 * Standalone Agent Setup Script
 * 
 * This script creates a fully functioning agent by:
 * 1. Creating all necessary topics (inbound, outbound, and profile topics)
 * 2. Setting up the agent profile
 * 3. Storing all topic IDs for later use
 * 
 * This approach doesn't rely on the Moonscape registry topic,
 * which appears to be inaccessible.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile } from 'fs/promises';
import { 
  Client, 
  PrivateKey, 
  TopicCreateTransaction,
  TopicMessageSubmitTransaction
} from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Constants
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
  console.log(`${colors.magenta}Lynxify Standalone Agent Setup${colors.reset}`);
  console.log(`${colors.magenta}=====================================${colors.reset}`);
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    console.error(`${colors.red}❌ Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.blue}ℹ️ Using account: ${operatorId}${colors.reset}`);
  
  try {
    // Initialize Hedera client
    console.log(`\n${colors.blue}🔄 Initializing Hedera client...${colors.reset}`);
    const client = Client.forTestnet();
    client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
    console.log(`${colors.green}✅ Client initialized successfully${colors.reset}`);
    
    // Create all required topics
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
    
    console.log(`\n${colors.blue}🔄 Creating profile topic...${colors.reset}`);
    const profileTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Profile Topic")
      .execute(client);
    
    const profileTopicReceipt = await profileTopicTx.getReceipt(client);
    const profileTopicId = profileTopicReceipt.topicId.toString();
    console.log(`${colors.green}✅ Profile topic created: ${profileTopicId}${colors.reset}`);
    
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
    
    // Publish profile to our own topic
    console.log(`\n${colors.blue}🔄 Publishing profile...${colors.reset}`);
    const profileTx = await new TopicMessageSubmitTransaction()
      .setTopicId(profileTopicId)
      .setMessage(JSON.stringify(agentProfile))
      .execute(client);
    
    const profileReceipt = await profileTx.getReceipt(client);
    console.log(`${colors.green}✅ Profile published successfully${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Transaction ID: ${profileTx.transactionId.toString()}${colors.reset}`);
    console.log(`${colors.blue}ℹ️ Sequence Number: ${profileReceipt.topicSequenceNumber.toString()}${colors.reset}`);
    
    // Save all information
    const registrationInfo = {
      accountId: operatorId,
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId,
      profileTopicId: profileTopicId,
      profileTimestamp: agentProfile.timestamp,
      profileTxId: profileTx.transactionId.toString(),
      created: new Date().toISOString()
    };
    
    await writeFile(REGISTRATION_STATUS_FILE, JSON.stringify(registrationInfo, null, 2));
    console.log(`\n${colors.green}✅ Agent information saved to ${REGISTRATION_STATUS_FILE}${colors.reset}`);
    
    // Success message with verification links
    console.log(`\n${colors.green}🎉 AGENT SETUP COMPLETE!${colors.reset}`);
    console.log(`${colors.green}Your agent is now ready to use.${colors.reset}`);
    console.log(`\n${colors.cyan}📊 Verify on Hashscan:${colors.reset}`);
    console.log(`${colors.cyan}  Agent Account: https://hashscan.io/testnet/account/${operatorId}${colors.reset}`);
    console.log(`${colors.cyan}  Inbound Topic: https://hashscan.io/testnet/topic/${inboundTopicId}${colors.reset}`);
    console.log(`${colors.cyan}  Outbound Topic: https://hashscan.io/testnet/topic/${outboundTopicId}${colors.reset}`);
    console.log(`${colors.cyan}  Profile Topic: https://hashscan.io/testnet/topic/${profileTopicId}${colors.reset}`);
    console.log(`${colors.cyan}  Profile Tx: https://hashscan.io/testnet/transaction/${profileTx.transactionId.toString()}${colors.reset}`);
    
    // Environment variables to set
    console.log(`\n${colors.yellow}⚠️ Add these environment variables to your .env.local file:${colors.reset}`);
    console.log(`${colors.yellow}NEXT_PUBLIC_HCS_INBOUND_TOPIC=${inboundTopicId}${colors.reset}`);
    console.log(`${colors.yellow}NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=${outboundTopicId}${colors.reset}`);
    console.log(`${colors.yellow}NEXT_PUBLIC_HCS_PROFILE_TOPIC=${profileTopicId}${colors.reset}`);
  
  } catch (error) {
    console.error(`\n${colors.red}❌ Error during setup process: ${error.message}${colors.reset}`);
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