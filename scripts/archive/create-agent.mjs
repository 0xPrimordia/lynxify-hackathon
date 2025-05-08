#!/usr/bin/env node

/**
 * Agent Setup Script
 * Creates all necessary topics for a working agent
 */

import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// File path for storing registration info
const REGISTRATION_FILE = join(process.cwd(), '.registration_status.json');

async function main() {
  console.log('==================================');
  console.log('Lynxify Agent Setup');
  console.log('==================================');
  
  // Check environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    console.error('❌ Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.');
    process.exit(1);
  }
  
  console.log(`Using account: ${operatorId}`);
  
  try {
    // Initialize Hedera client
    console.log('\nInitializing Hedera client...');
    const client = Client.forTestnet();
    client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
    console.log('✅ Client initialized successfully');
    
    // Create inbound topic
    console.log('\nCreating inbound topic...');
    const inboundTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Inbound Topic")
      .execute(client);
    
    const inboundTopicReceipt = await inboundTopicTx.getReceipt(client);
    const inboundTopicId = inboundTopicReceipt.topicId.toString();
    console.log(`✅ Inbound topic created: ${inboundTopicId}`);
    
    // Create outbound topic
    console.log('\nCreating outbound topic...');
    const outboundTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Outbound Topic")
      .execute(client);
    
    const outboundTopicReceipt = await outboundTopicTx.getReceipt(client);
    const outboundTopicId = outboundTopicReceipt.topicId.toString();
    console.log(`✅ Outbound topic created: ${outboundTopicId}`);
    
    // Create profile topic
    console.log('\nCreating profile topic...');
    const profileTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Lynxify Agent Profile Topic")
      .execute(client);
    
    const profileTopicReceipt = await profileTopicTx.getReceipt(client);
    const profileTopicId = profileTopicReceipt.topicId.toString();
    console.log(`✅ Profile topic created: ${profileTopicId}`);
    
    // Create agent profile
    console.log('\nCreating agent profile...');
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
    
    // Publish profile
    console.log('\nPublishing profile...');
    const profileTx = await new TopicMessageSubmitTransaction()
      .setTopicId(profileTopicId)
      .setMessage(JSON.stringify(agentProfile))
      .execute(client);
    
    const profileReceipt = await profileTx.getReceipt(client);
    console.log('✅ Profile published successfully');
    console.log(`Transaction ID: ${profileTx.transactionId.toString()}`);
    console.log(`Sequence Number: ${profileReceipt.topicSequenceNumber.toString()}`);
    
    // Save registration info
    const registrationInfo = {
      accountId: operatorId,
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId,
      profileTopicId: profileTopicId,
      timestamp: Date.now()
    };
    
    await writeFile(REGISTRATION_FILE, JSON.stringify(registrationInfo, null, 2));
    console.log(`\n✅ Registration information saved to ${REGISTRATION_FILE}`);
    
    // Show verification links
    console.log('\n🎉 AGENT SETUP COMPLETE!');
    console.log('Your agent is now ready to use.');
    console.log('\nVerify on Hashscan:');
    console.log(`Agent Account: https://hashscan.io/testnet/account/${operatorId}`);
    console.log(`Inbound Topic: https://hashscan.io/testnet/topic/${inboundTopicId}`);
    console.log(`Outbound Topic: https://hashscan.io/testnet/topic/${outboundTopicId}`);
    console.log(`Profile Topic: https://hashscan.io/testnet/topic/${profileTopicId}`);
    
    // Show environment variables
    console.log('\nAdd these environment variables to your .env.local file:');
    console.log(`NEXT_PUBLIC_HCS_INBOUND_TOPIC=${inboundTopicId}`);
    console.log(`NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=${outboundTopicId}`);
    console.log(`NEXT_PUBLIC_HCS_PROFILE_TOPIC=${profileTopicId}`);
  } catch (error) {
    console.error(`\nError during setup: ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(`\nUnhandled error: ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exit(1);
}); 