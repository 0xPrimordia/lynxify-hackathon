#!/usr/bin/env node

/**
 * Agent Profile Publisher for Moonscape
 * 
 * Publishes the agent profile to the Moonscape registry topic
 * This is required for the agent to appear on Moonscape
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, access } from 'fs/promises';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get current directory for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REGISTRATION_STATUS_FILE = join(process.cwd(), '.registration_status.json');

// Helper function to check if file exists
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Main function
async function main() {
  console.log('==================================');
  console.log('Lynxify Agent Profile Publisher');
  console.log('==================================');
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    console.error('❌ Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.');
    process.exit(1);
  }
  
  // Load registration info
  let registrationInfo;
  try {
    if (!await fileExists(REGISTRATION_STATUS_FILE)) {
      console.error('❌ Agent not registered. Please run registration script first.');
      process.exit(1);
    }
    
    const data = await readFile(REGISTRATION_STATUS_FILE, 'utf8');
    registrationInfo = JSON.parse(data);
    
    console.log('✅ Agent registration found:');
    console.log(`  Agent ID: ${registrationInfo.accountId}`);
    console.log(`  Inbound Topic: ${registrationInfo.inboundTopicId}`);
    console.log(`  Outbound Topic: ${registrationInfo.outboundTopicId}`);
    console.log(`  Registry Topic: ${registrationInfo.registryTopic}`);
  } catch (error) {
    console.error(`❌ Failed to load registration info: ${error.message}`);
    process.exit(1);
  }
  
  // Initialize Hedera client
  try {
    console.log('\n🔄 Initializing Hedera client...');
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    console.log('✅ Client initialized successfully');
    
    // Create agent profile according to HCS-10 standard
    const agentProfile = {
      p: "hcs-10",
      op: "profile",
      agent_id: registrationInfo.accountId,
      inbound_topic: registrationInfo.inboundTopicId,
      name: "Lynxify Index Agent",
      description: "A HCS-10 agent for the Lynxify tokenized index",
      version: "1.0.0",
      capabilities: ["rebalance", "tokenized-index"],
      timestamp: Date.now()
    };
    
    console.log('\n📝 Agent profile created:');
    console.log(JSON.stringify(agentProfile, null, 2));
    
    // Submit the profile message to the registry topic
    console.log(`\n🔄 Sending profile to registry topic ${registrationInfo.registryTopic}...`);
    
    const messageTransaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(registrationInfo.registryTopic))
      .setMessage(JSON.stringify(agentProfile));
    
    const messageSubmit = await messageTransaction.execute(client);
    const messageReceipt = await messageSubmit.getReceipt(client);
    
    console.log('✅ Profile successfully published!');
    console.log(`  Transaction ID: ${messageSubmit.transactionId.toString()}`);
    console.log(`  Topic Sequence: ${messageReceipt.topicSequenceNumber.toString()}`);
    
    // Save profile info
    await writeFile('.profile_info.json', JSON.stringify({
      agentId: registrationInfo.accountId,
      profileTimestamp: agentProfile.timestamp,
      registryTopic: registrationInfo.registryTopic,
      transactionId: messageSubmit.transactionId.toString(),
      published: new Date().toISOString()
    }, null, 2));
    
    console.log('\n✅ Profile information saved to .profile_info.json');
    console.log('\n🎉 Agent profile published! You can now connect on Moonscape.');
    console.log('   Visit: https://moonscape.tech/openconvai and connect to your agent.');
    
    // Hashscan links for verification
    console.log('\n📊 Verify your transactions on Hashscan:');
    console.log(`  Profile Message: https://hashscan.io/testnet/transaction/${messageSubmit.transactionId.toString()}`);
    console.log(`  Agent Account: https://hashscan.io/testnet/account/${registrationInfo.accountId}`);
    console.log(`  Registry Topic: https://hashscan.io/testnet/topic/${registrationInfo.registryTopic}`);
    console.log(`  Inbound Topic: https://hashscan.io/testnet/topic/${registrationInfo.inboundTopicId}`);
    console.log(`  Outbound Topic: https://hashscan.io/testnet/topic/${registrationInfo.outboundTopicId}`);
  } catch (error) {
    console.error(`❌ Failed to publish profile: ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 