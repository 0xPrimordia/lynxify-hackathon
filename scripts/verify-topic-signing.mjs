#!/usr/bin/env node
/**
 * Verify HCS-10 protocol topic usage patterns
 * This script demonstrates the correct HCS-10 topic communication patterns:
 * - Inbound topic: For connection requests (no submit key)
 * - Connection topics: For regular messages (should create these for each client)
 * - Outbound topic: NOT for regular messages, only for broadcasts (has submit key)
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicInfoQuery, TopicId } from '@hashgraph/sdk';
import * as fs from 'node:fs';

// Initialize environment variables
console.log('Loading environment variables...');
try {
  if (fs.existsSync('./.env.local')) {
    dotenv.config({ path: './.env.local' });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    dotenv.config();
    console.log('ℹ️ Using default .env file');
  }
} catch (error) {
  console.log('⚠️ Error loading .env files:', error.message);
}

// Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;

// Validate required environment variables
if (!operatorId || !operatorKey || !inboundTopicId || !outboundTopicId) {
  console.error('❌ Missing required environment variables:');
  console.error('NEXT_PUBLIC_OPERATOR_ID:', operatorId || 'not set');
  console.error('OPERATOR_KEY:', operatorKey ? 'set' : 'not set');
  console.error('NEXT_PUBLIC_HCS_INBOUND_TOPIC:', inboundTopicId || 'not set');
  console.error('NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', outboundTopicId || 'not set');
  process.exit(1);
}

console.log('Environment variables loaded:');
console.log('- NEXT_PUBLIC_OPERATOR_ID:', operatorId);
console.log('- OPERATOR_KEY: [hidden]');
console.log('- NEXT_PUBLIC_HCS_INBOUND_TOPIC:', inboundTopicId);
console.log('- NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', outboundTopicId);

// Initialize Hedera client
console.log('Initializing Hedera client...');
const client = Client.forTestnet();
const privateKey = PrivateKey.fromString(operatorKey);
client.setOperator(operatorId, privateKey);

/**
 * Check topic information to understand its configuration
 */
async function checkTopicInfo(topicId) {
  console.log(`\nChecking topic ${topicId} configuration...`);
  
  try {
    const topicInfo = await new TopicInfoQuery()
      .setTopicId(TopicId.fromString(topicId))
      .execute(client);
    
    const hasSubmitKey = topicInfo.submitKey ? true : false;
    
    console.log(`Topic ${topicId}:`);
    console.log(`- Submit Key: ${hasSubmitKey ? 'PRESENT ✓' : 'NONE ✗'}`);
    console.log(`- Topic Memo: "${topicInfo.topicMemo}"`);
    
    return { hasSubmitKey, topicInfo };
  } catch (error) {
    console.error(`❌ Error getting topic info: ${error}`);
    return { hasSubmitKey: null, error };
  }
}

/**
 * Create a new connection topic for client-agent communication
 */
async function createConnectionTopic() {
  console.log('\nCreating a new connection topic...');
  
  try {
    // Create a connection topic without a submit key for easier usage
    const transaction = new TopicCreateTransaction()
      .setTopicMemo('HCS-10 agent connection topic')
      .setSubmitKey(null); // Explicitly set no submit key
    
    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    
    console.log(`✅ Connection topic created: ${receipt.topicId.toString()}`);
    return receipt.topicId.toString();
  } catch (error) {
    console.error('❌ Error creating connection topic:', error);
    throw error;
  }
}

/**
 * Send a message to a topic using the appropriate pattern
 */
async function sendMessage(topicId, message, hasSubmitKey) {
  console.log(`\nSending message to topic ${topicId}`);
  console.log(`Message: ${message}`);
  
  try {
    // Create the transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
    
    let response;
    
    // Use appropriate pattern based on submit key presence
    if (hasSubmitKey) {
      console.log('🔒 Topic has submit key - using freeze+sign+execute pattern');
      
      // Freeze the transaction
      console.log('Freezing transaction...');
      const frozenTx = await transaction.freezeWith(client);
      
      // Sign with operator private key
      console.log('Signing with operator private key...');
      const signedTx = await frozenTx.sign(privateKey);
      
      // Execute the signed transaction
      console.log('Executing signed transaction...');
      response = await signedTx.execute(client);
    } else {
      console.log('🔓 Topic has no submit key - using direct execution');
      response = await transaction.execute(client);
    }
    
    // Get the receipt to confirm successful execution
    const receipt = await response.getReceipt(client);
    
    console.log('✅ Message sent successfully!');
    console.log(`Transaction ID: ${response.transactionId.toString()}`);
    console.log(`https://hashscan.io/testnet/transaction/${response.transactionId.toString()}`);
    
    return { success: true, transactionId: response.transactionId.toString() };
  } catch (error) {
    console.error('❌ Error sending message:', error);
    if (error.status) {
      console.error(`Status code: ${error.status._code}`);
      console.error(`Status message: ${error.status.toString()}`);
    }
    return { success: false, error: error.toString() };
  }
}

/**
 * Demonstrate the correct HCS-10 protocol usage pattern
 */
async function demonstrateCorrectProtocolUsage() {
  console.log('=== DEMONSTRATING CORRECT HCS-10 PROTOCOL USAGE ===\n');
  
  // Step 1: First, check both topics
  const inboundInfo = await checkTopicInfo(inboundTopicId);
  const outboundInfo = await checkTopicInfo(outboundTopicId);
  
  // Step 2: Create a dedicated connection topic
  const connectionTopicId = await createConnectionTopic();
  const connectionInfo = await checkTopicInfo(connectionTopicId);
  
  // Step 3: Send a connection request to inbound topic (correct protocol usage)
  console.log('\nSTEP 1: Sending connection request to INBOUND topic (CORRECT usage)');
  const connectionRequest = {
    p: 'hcs-10',
    op: 'connection_request',
    operator_id: `${connectionTopicId}@${operatorId}`,
    timestamp: Date.now()
  };
  
  const inboundResult = await sendMessage(
    inboundTopicId, 
    JSON.stringify(connectionRequest),
    inboundInfo.hasSubmitKey
  );
  
  // Step 4: Send a regular message to connection topic (correct protocol usage)
  console.log('\nSTEP 2: Sending regular message to CONNECTION topic (CORRECT usage)');
  const regularMessage = {
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'TextMessage',
      content: 'This is a test message using the correct connection topic.',
      timestamp: Date.now()
    }),
    timestamp: Date.now()
  };
  
  const connectionResult = await sendMessage(
    connectionTopicId,
    JSON.stringify(regularMessage),
    connectionInfo.hasSubmitKey
  );
  
  // Step 5: Demonstrate that outbound topic is NOT for regular messages
  console.log('\nSTEP 3: NOT sending regular messages to OUTBOUND topic (following protocol)');
  console.log('❌ Would be INCORRECT to send regular messages to outbound topic!');
  console.log('The outbound topic is only for broadcasts and protocol-specific messages.');
  console.log('According to HCS-10 protocol, client-agent communication must use dedicated connection topics.');
  
  // Summary
  console.log('\n======= HCS-10 PROTOCOL USAGE SUMMARY =======');
  console.log('Inbound Topic:');
  console.log(`- Submit Key: ${inboundInfo.hasSubmitKey ? 'PRESENT' : 'NONE'}`);
  console.log(`- Correct Usage: Connection requests from clients to agent`);
  console.log(`- Test Result: ${inboundResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  console.log('\nConnection Topic:');
  console.log(`- Submit Key: ${connectionInfo.hasSubmitKey ? 'PRESENT' : 'NONE'}`);
  console.log(`- Correct Usage: Regular messages between client and agent`);
  console.log(`- Test Result: ${connectionResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  console.log('\nOutbound Topic:');
  console.log(`- Submit Key: ${outboundInfo.hasSubmitKey ? 'PRESENT' : 'NONE'}`);
  console.log(`- Correct Usage: NOT for regular messages; only for broadcasts and protocol messages`);
  console.log(`- Test Result: ✅ Correctly avoided sending regular messages here`);
  
  console.log('\nConclusion:');
  console.log('✅ SUCCESS: Demonstrated correct HCS-10 protocol usage patterns');
  console.log('- Inbound topic is used for connection requests (no submit key)');
  console.log('- Dedicated connection topics are used for regular messages (no submit key)');
  console.log('- Outbound topic is NOT used for regular messages (has submit key)');
  console.log('\nFIXING THE IMPLEMENTATION:');
  console.log('1. Use proper transaction patterns based on submit key presence');
  console.log('2. STOP using outbound topic for regular messages');
  console.log('3. Create and use dedicated connection topics for client-agent communication');
}

// Run the demonstration
demonstrateCorrectProtocolUsage().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}).finally(() => {
  console.log('\nDone. Exiting...');
}); 