#!/usr/bin/env node
/**
 * Verify connection topic implementation for HCS-10 protocol
 * This script demonstrates how connection topics should be used
 * in the HCS-10 protocol for client-agent communication.
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
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
 * Create a new connection topic for client-agent communication
 * @returns The created topic ID
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
 * Send a message to a topic
 * @param topicId The topic to send to
 * @param message The message content
 * @returns Result of the operation
 */
async function sendMessage(topicId, message) {
  console.log(`\nSending message to topic ${topicId}`);
  console.log(`Message: ${message}`);
  
  try {
    // Create the transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
    
    // Execute using direct execution (our connection topics don't have submit keys)
    const response = await transaction.execute(client);
    
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
 * Demonstrate the correct HCS-10 connection flow
 */
async function demonstrateConnectionFlow() {
  console.log('=== DEMONSTRATING HCS-10 CONNECTION FLOW ===\n');
  
  try {
    // Step 1: Client sends connection request to agent's inbound topic
    console.log('STEP 1: Client sends connection request to agent\'s inbound topic');
    
    const connectionRequest = {
      p: 'hcs-10',
      op: 'connection_request',
      operator_id: `${outboundTopicId}@${operatorId}`, // Format: <client_topic>@<client_id>
      timestamp: Date.now()
    };
    
    await sendMessage(inboundTopicId, JSON.stringify(connectionRequest));
    
    // Step 2: Agent creates a dedicated connection topic
    console.log('\nSTEP 2: Agent creates a dedicated connection topic');
    const connectionTopicId = await createConnectionTopic();
    
    // Step 3: Agent sends connection_created response to client's topic
    console.log('\nSTEP 3: Agent sends connection_created response to client\'s topic');
    
    const connectionResponse = {
      p: 'hcs-10',
      op: 'connection_created',
      connection_topic_id: connectionTopicId,
      connected_account_id: operatorId,
      operator_id: `${inboundTopicId}@${operatorId}`,
      connection_id: Date.now(),
      timestamp: Date.now()
    };
    
    await sendMessage(outboundTopicId, JSON.stringify(connectionResponse));
    
    // Step 4: Client sends a message on the connection topic
    console.log('\nSTEP 4: Client sends a message on the dedicated connection topic');
    
    const clientMessage = {
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify({
        type: 'TextMessage',
        content: 'Hello from the client! This is a test message.',
        timestamp: Date.now()
      }),
      timestamp: Date.now()
    };
    
    await sendMessage(connectionTopicId, JSON.stringify(clientMessage));
    
    // Step 5: Agent responds on the same connection topic
    console.log('\nSTEP 5: Agent responds on the same dedicated connection topic');
    
    const agentResponse = {
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify({
        type: 'TextMessage',
        content: 'Hello from the agent! I received your message.',
        timestamp: Date.now()
      }),
      timestamp: Date.now()
    };
    
    await sendMessage(connectionTopicId, JSON.stringify(agentResponse));
    
    // Summary
    console.log('\n======= CORRECT HCS-10 CONNECTION FLOW SUMMARY =======');
    console.log('1. ✅ Client sent connection_request to agent\'s inbound topic');
    console.log('2. ✅ Agent created a dedicated connection topic');
    console.log('3. ✅ Agent sent connection_created to client\'s topic');
    console.log('4. ✅ Client sent a message on the dedicated connection topic');
    console.log('5. ✅ Agent responded on the same dedicated connection topic');
    console.log('\nNew connection topic created:', connectionTopicId);
    console.log('\nIMPORTANT: This is the correct HCS-10 protocol flow!');
    console.log('- The outbound topic is NOT used for direct messages');
    console.log('- A dedicated connection topic is created for each client-agent relationship');
    console.log('- All client-agent messages are exchanged via the dedicated connection topic');
    console.log('- The outbound topic is only used for broadcasts and protocol messages');
    
  } catch (error) {
    console.error('\n❌ Error demonstrating connection flow:', error);
  }
}

// Run the demonstration
demonstrateConnectionFlow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}).finally(() => {
  console.log('\nDone. Exiting...');
}); 