#!/usr/bin/env node

/**
 * Transaction Pattern Test Tool
 * 
 * This script tests different transaction patterns on both inbound and outbound topics
 * to determine which patterns work for which topics.
 */

import dotenv from 'dotenv';
import * as fs from 'node:fs';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicId, TopicInfoQuery } from '@hashgraph/sdk';

// Check if .env.local exists before trying to load it
try {
  if (fs.existsSync('./.env.local')) {
    dotenv.config({ path: './.env.local' });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    dotenv.config(); // Try default .env file
    console.log('⚠️ No .env.local file found, using default .env');
  }
} catch (error) {
  console.log('⚠️ Error checking for .env file:', error.message);
}

// Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
const networkName = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

console.log('🧪 Transaction Pattern Test Tool');
console.log('Environment variables loaded:');
console.log(`- Operator ID: ${operatorId}`);
console.log(`- Operator Key exists: ${!!operatorKey}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);
console.log(`- Network: ${networkName}`);

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

/**
 * Get topic information to check for submit key
 * @param {string} topicId The topic ID to query
 * @param {Client} client The Hedera client
 * @returns {Promise<object>} The topic info
 */
async function getTopicInfo(topicId, client) {
  console.log(`\n🔄 Fetching info for topic ${topicId}...`);
  
  try {
    // Query the topic information
    const info = await new TopicInfoQuery()
      .setTopicId(TopicId.fromString(topicId))
      .execute(client);
    
    console.log(`Topic ${topicId} configuration:`);
    console.log(`- Submit Key: ${info.submitKey ? 'PRESENT ✓' : 'NONE ✗'}`);
    console.log(`- Admin Key: ${info.adminKey ? 'PRESENT ✓' : 'NONE ✗'}`);
    
    return info;
  } catch (error) {
    console.error(`❌ Error fetching info for topic ${topicId}:`, error);
    return null;
  }
}

/**
 * Test different transaction patterns on a topic
 * @param {string} topicId The topic ID to test
 * @param {Client} client The Hedera client
 * @param {PrivateKey} operatorPrivateKey The operator's private key
 */
async function testTransactionPatterns(topicId, client, operatorPrivateKey) {
  console.log(`\n🧪 Testing transaction patterns on topic ${topicId}`);
  
  // Get topic info to check if it has a submit key
  const info = await getTopicInfo(topicId, client);
  const hasSubmitKey = !!info?.submitKey;
  
  // Create a test message
  const message = `Test message from pattern test: ${Date.now()}`;
  const results = {
    topicId,
    hasSubmitKey,
    patterns: {}
  };
  
  // Pattern 1: Direct Execution
  try {
    console.log("\n🧪 PATTERN 1: Direct Execution");
    console.log("Creating transaction with direct execute...");
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
      
    console.log("Executing transaction directly...");
    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    
    console.log("✅ PATTERN 1 SUCCESS");
    console.log(`Transaction ID: ${response.transactionId.toString()}`);
    
    results.patterns.directExecution = {
      success: true,
      transactionId: response.transactionId.toString()
    };
  } catch (error) {
    console.error("❌ PATTERN 1 FAILED:", error);
    let errorDetails = error.toString();
    if (error.status) {
      errorDetails = `${error.status.toString()} (${error.status._code})`;
    }
    results.patterns.directExecution = {
      success: false,
      error: errorDetails
    };
  }
  
  // Pattern 2: Freeze + Sign with Operator Key + Execute
  try {
    console.log("\n🧪 PATTERN 2: Freeze + Sign with Operator Key + Execute");
    console.log("Creating transaction...");
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
      
    console.log("Freezing transaction...");
    const frozenTx = await transaction.freezeWith(client);
    
    console.log("Signing with operator key...");
    const signedTx = await frozenTx.sign(operatorPrivateKey);
    
    console.log("Executing signed transaction...");
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);
    
    console.log("✅ PATTERN 2 SUCCESS");
    console.log(`Transaction ID: ${response.transactionId.toString()}`);
    
    results.patterns.freezeSignOperator = {
      success: true,
      transactionId: response.transactionId.toString()
    };
  } catch (error) {
    console.error("❌ PATTERN 2 FAILED:", error);
    let errorDetails = error.toString();
    if (error.status) {
      errorDetails = `${error.status.toString()} (${error.status._code})`;
    }
    results.patterns.freezeSignOperator = {
      success: false,
      error: errorDetails
    };
  }
  
  // Pattern 3: Freeze + Sign with ED25519 + Execute
  try {
    console.log("\n🧪 PATTERN 3: Freeze + Sign with explicit ED25519 key + Execute");
    console.log("Creating transaction...");
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);
      
    console.log("Freezing transaction...");
    const frozenTx = await transaction.freezeWith(client);
    
    console.log("Creating ED25519 key and signing...");
    const ed25519Key = PrivateKey.fromStringED25519(operatorKey);
    console.log(`Key type: ${ed25519Key._isED25519 ? 'ED25519' : 'UNKNOWN'}`);
    
    const signedTx = await frozenTx.sign(ed25519Key);
    
    console.log("Executing signed transaction...");
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);
    
    console.log("✅ PATTERN 3 SUCCESS");
    console.log(`Transaction ID: ${response.transactionId.toString()}`);
    
    results.patterns.freezeSignED25519 = {
      success: true,
      transactionId: response.transactionId.toString()
    };
  } catch (error) {
    console.error("❌ PATTERN 3 FAILED:", error);
    let errorDetails = error.toString();
    if (error.status) {
      errorDetails = `${error.status.toString()} (${error.status._code})`;
    }
    results.patterns.freezeSignED25519 = {
      success: false,
      error: errorDetails
    };
  }
  
  return results;
}

/**
 * Main function to run all tests
 */
async function runAllTests() {
  try {
    // Initialize Hedera client
    console.log(`\n🔄 Initializing Hedera client for ${networkName}...`);
    
    const client = networkName === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    // Create private key instance
    const privateKey = PrivateKey.fromString(operatorKey);
    
    // Set operator
    client.setOperator(operatorId, privateKey);
    console.log('✅ Client initialized successfully');
    
    // Test patterns on inbound topic
    console.log('\n🔄 Testing inbound topic...');
    const inboundResults = await testTransactionPatterns(inboundTopicId, client, privateKey);
    
    // Test patterns on outbound topic
    console.log('\n🔄 Testing outbound topic...');
    const outboundResults = await testTransactionPatterns(outboundTopicId, client, privateKey);
    
    // Compile results
    const allResults = {
      inboundTopic: inboundResults,
      outboundTopic: outboundResults,
      timestamp: new Date().toISOString()
    };
    
    // Write results to a file
    const filename = `transaction-patterns-results-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(allResults, null, 2));
    console.log(`\n✅ Results saved to ${filename}`);
    
    // Print summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('┌───────────────────────────┬────────────────┬─────────────────┐');
    console.log('│ Pattern                   │ Inbound Topic  │ Outbound Topic  │');
    console.log('├───────────────────────────┼────────────────┼─────────────────┤');
    console.log(`│ Direct Execution          │ ${(inboundResults.patterns.directExecution.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(14)} │ ${(outboundResults.patterns.directExecution.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(15)} │`);
    console.log(`│ Freeze+Sign (Operator)    │ ${(inboundResults.patterns.freezeSignOperator.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(14)} │ ${(outboundResults.patterns.freezeSignOperator.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(15)} │`);
    console.log(`│ Freeze+Sign (ED25519)     │ ${(inboundResults.patterns.freezeSignED25519.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(14)} │ ${(outboundResults.patterns.freezeSignED25519.success ? 'SUCCESS ✅' : 'FAILED ❌').padEnd(15)} │`);
    console.log('└───────────────────────────┴────────────────┴─────────────────┘');
    
  } catch (error) {
    console.error('❌ Error running tests:', error);
  }
}

// Run all tests
runAllTests().then(() => {
  console.log('\n✅ All tests completed');
}).catch(error => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
}); 