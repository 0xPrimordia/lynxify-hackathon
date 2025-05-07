#!/usr/bin/env node

/**
 * Topic Test Script
 * Test basic Hedera topic functionality
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicCreateTransaction, TopicInfoQuery, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Main function
async function main() {
  try {
    console.log('==================================');
    console.log('Hedera Topic Test Script');
    console.log('==================================');
    
    // Check environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      console.error('Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.');
      process.exit(1);
    }
    
    console.log(`Using account: ${operatorId}`);
    
    // Initialize Hedera client
    console.log('\nInitializing Hedera client...');
    const client = Client.forTestnet();
    client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
    console.log('✅ Client initialized successfully');
    
    // Create a test topic
    console.log('\nCreating test topic...');
    const testTopicTx = await new TopicCreateTransaction()
      .setAdminKey(PrivateKey.fromString(operatorKey))
      .setSubmitKey(PrivateKey.fromString(operatorKey))
      .setTopicMemo("Test Topic")
      .execute(client);
    
    const testTopicReceipt = await testTopicTx.getReceipt(client);
    const testTopicId = testTopicReceipt.topicId.toString();
    console.log(`✅ Test topic created: ${testTopicId}`);
    
    // Query the topic info
    console.log('\nQuerying topic info...');
    try {
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(testTopicId)
        .execute(client);
      
      console.log('✅ Topic info retrieved successfully:');
      console.log(`Topic ID: ${testTopicId}`);
      console.log(`Topic Memo: ${topicInfo.topicMemo}`);
    } catch (error) {
      console.error(`❌ Error querying topic info: ${error.message}`);
    }
    
    // Send a message to the topic
    console.log('\nSending test message to topic...');
    try {
      const testMessage = {
        message: "Test message",
        timestamp: Date.now()
      };
      
      const messageTx = await new TopicMessageSubmitTransaction()
        .setTopicId(testTopicId)
        .setMessage(JSON.stringify(testMessage))
        .execute(client);
      
      const messageReceipt = await messageTx.getReceipt(client);
      console.log('✅ Message sent successfully');
      console.log(`Sequence Number: ${messageReceipt.topicSequenceNumber.toString()}`);
    } catch (error) {
      console.error(`❌ Error sending message: ${error.message}`);
    }
    
    console.log('\n==================================');
    console.log('Test completed successfully');
    console.log('==================================');
    
    // Print verification link
    console.log(`\nVerify on Hashscan: https://hashscan.io/testnet/topic/${testTopicId}`);
  } catch (error) {
    console.error(`\nError during test: ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 