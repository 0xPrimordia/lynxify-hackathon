#!/usr/bin/env node
/**
 * Topic Signing Test
 * 
 * This script tests sending messages to both inbound and outbound topics
 * to diagnose the INVALID_SIGNATURE issue we're experiencing with certain topics.
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicMessageSubmitTransaction, Hbar } from '@hashgraph/sdk';
import * as fs from 'node:fs';

// Check if .env.local exists before trying to load it
try {
  if (fs.existsSync('./.env.local')) {
    dotenv.config({ path: './.env.local' });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    console.log('⚠️ No .env.local file found, using environment variables directly');
  }
} catch (error) {
  console.log('⚠️ Error checking for .env.local:', error.message);
}

// Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
const networkName = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

console.log('Environment variables loaded:');
console.log('- NEXT_PUBLIC_OPERATOR_ID:', operatorId || 'not set');
console.log('- OPERATOR_KEY exists:', !!operatorKey);
console.log('- NEXT_PUBLIC_HCS_INBOUND_TOPIC:', inboundTopicId || 'not set');
console.log('- NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', outboundTopicId || 'not set');
console.log('- NEXT_PUBLIC_NETWORK:', networkName || 'not set');

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_OPERATOR_ID',
  'OPERATOR_KEY',
  'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
  'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Create a .env file with these variables and try again.');
  process.exit(1);
}

// Main test runner
async function runTest() {
  console.log('🧪 Starting Topic Signing Test');
  console.log('This test will send identical messages to both topics to compare behavior');
  
  // Initialize client
  console.log('🔄 Initializing Hedera client...');
  const client = initializeClient();
  
  // Prepare an identical test message for both topics
  const testMessage = {
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'DiagnosticTest',
      content: 'Testing topic transaction signing behavior',
      timestamp: new Date().toISOString()
    })
  };
  const messageString = JSON.stringify(testMessage);
  
  // Try all combinations of patterns
  const methods = [
    { name: 'Builder + FreezeSign + Execute', fn: sendWithFreezeSign },
    { name: 'Constructor + Execute', fn: sendWithConstructor },
    { name: 'Builder + Direct Execute', fn: sendWithBuilderDirect }
  ];
  
  const topics = [
    { name: 'Inbound Topic', id: inboundTopicId },
    { name: 'Outbound Topic', id: outboundTopicId }
  ];
  
  // Test matrix
  console.log('\n📊 Running test matrix (all methods x all topics)...\n');
  const results = [];

  for (const method of methods) {
    console.log(`\n🔍 Testing Method: ${method.name}\n`);
    
    for (const topic of topics) {
      console.log(`📤 Sending to ${topic.name} (${topic.id})...`);
      
      try {
        const result = await method.fn(client, topic.id, messageString);
        results.push({ 
          method: method.name, 
          topic: topic.name, 
          topicId: topic.id,
          success: true,
          transactionId: result.transactionId,
          details: 'Success'
        });
        console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
      } catch (error) {
        results.push({ 
          method: method.name, 
          topic: topic.name, 
          topicId: topic.id,
          success: false,
          error: error.toString(),
          statusCode: error.status?._code,
          statusName: error.status?.toString()
        });
        console.log(`❌ Failed! Error: ${error.toString()}`);
        if (error.status) {
          console.log(`   Status: ${error.status.toString()} (${error.status._code})`);
        }
      }
      
      // Short delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Print results summary
  console.log('\n📝 Results Summary:');
  console.log('--------------------------------------------------');
  console.log('Method                       | Topic    | Result');
  console.log('--------------------------------------------------');
  
  for (const result of results) {
    const methodPadded = result.method.padEnd(28);
    const topicPadded = result.topic.padEnd(9);
    const resultText = result.success ? '✅ Success' : `❌ ${result.statusName || 'Failed'}`;
    console.log(`${methodPadded} | ${topicPadded} | ${resultText}`);
  }
  
  console.log('--------------------------------------------------');
  
  // Print detailed results for reference
  console.log('\n📋 Detailed Results:');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n🏁 Test completed');
}

// Initialize the Hedera client
function initializeClient() {
  try {
    // Create client for the specified network
    let client;
    if (networkName === 'testnet') {
      client = Client.forTestnet();
    } else if (networkName === 'mainnet') {
      client = Client.forMainnet();
    } else {
      throw new Error(`Unknown network: ${networkName}`);
    }
    
    // Log key details (not the actual key)
    console.log('Creating private key instance...');
    console.log(`Operator key length: ${operatorKey.length}`);
    console.log(`Operator key starts with: ${operatorKey.substring(0, 4)}...`);
    
    // Create private key instance - first try ED25519 method
    const privateKey = PrivateKey.fromStringED25519(operatorKey);
    console.log(`Private key class: ${privateKey.constructor.name}`);
    console.log(`Private key has public key: ${!!privateKey.publicKey}`);
    
    // Set operator for client
    client.setOperator(operatorId, privateKey);
    console.log('✅ Hedera client initialized successfully');
    
    return client;
  } catch (error) {
    console.error('❌ Error initializing client:', error);
    throw error;
  }
}

// Method 1: Builder pattern with freeze and sign
async function sendWithFreezeSign(client, topicId, message) {
  console.log('🔄 Using Builder + Freeze + Sign approach');
  
  try {
    // Create with builder pattern
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    console.log('Transaction created with builder pattern');
    console.log(`Target topic: ${topicId}`);
    console.log(`Message size: ${message.length} bytes`);
    
    // Freeze transaction
    console.log('Freezing transaction...');
    const txFrozen = await transaction.freezeWith(client);
    
    // Sign transaction
    console.log('Signing transaction...');
    const signedTx = await txFrozen.sign(client._operator.privateKey);
    
    // Execute transaction
    console.log('Executing signed transaction...');
    const response = await signedTx.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Builder + Freeze + Sign'
    };
  } catch (error) {
    console.error('Error in sendWithFreezeSign:', error);
    throw error;
  }
}

// Method 2: Constructor pattern with direct execution
async function sendWithConstructor(client, topicId, message) {
  console.log('🔄 Using Constructor + Direct Execute approach');
  
  try {
    // Create with constructor pattern
    const transaction = new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: message,
      maxTransactionFee: new Hbar(10)
    });
    
    console.log('Transaction created with constructor pattern');
    console.log(`Target topic: ${topicId}`);
    console.log(`Message size: ${message.length} bytes`);
    
    // Execute directly
    console.log('Executing transaction directly...');
    const response = await transaction.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Constructor + Direct Execute'
    };
  } catch (error) {
    console.error('Error in sendWithConstructor:', error);
    throw error;
  }
}

// Method 3: Builder pattern with direct execution
async function sendWithBuilderDirect(client, topicId, message) {
  console.log('🔄 Using Builder + Direct Execute approach');
  
  try {
    // Create with builder pattern
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    console.log('Transaction created with builder pattern');
    console.log(`Target topic: ${topicId}`);
    console.log(`Message size: ${message.length} bytes`);
    
    // Execute directly (without freeze/sign)
    console.log('Executing transaction directly...');
    const response = await transaction.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Builder + Direct Execute'
    };
  } catch (error) {
    console.error('Error in sendWithBuilderDirect:', error);
    throw error;
  }
}

// Run the test
runTest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 