#!/usr/bin/env node
/**
 * Standards SDK Analysis Script
 * 
 * This script analyzes how the Standards SDK handles topic submit keys
 * by comparing its implementation with our own approach.
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicInfoQuery, Hbar } from '@hashgraph/sdk';
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

// Main analysis function
async function analyzeStandardsSDK() {
  console.log('🔍 Starting Standards SDK Analysis');
  console.log('This test will analyze how the Standards SDK handles topic submit keys');
  
  // Initialize client
  console.log('🔄 Initializing Hedera client...');
  const client = initializeClient();
  
  // First, fetch topic information to get the submit keys
  console.log('🔄 Fetching topic information...');
  const topicInfos = await getTopicInfo(client);
  
  // Extract submit keys
  const inboundSubmitKey = topicInfos.inbound.submitKey;
  const outboundSubmitKey = topicInfos.outbound.submitKey;
  
  console.log('\n📊 Topic Submit Key Status:');
  console.log(`Inbound Topic (${inboundTopicId}): ${inboundSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  console.log(`Outbound Topic (${outboundTopicId}): ${outboundSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  
  // Construct a mock version of the Standards SDK implementation
  console.log('\n🔄 Testing Standards SDK-style implementation');
  
  // Prepare test message
  const testMessage = createTestMessage();
  const testResults = [];
  
  // Test 1: Standards SDK pattern for a topic WITH submit key (outbound)
  console.log('\n🧪 Test 1: Standards SDK pattern for outbound topic (WITH submit key)');
  try {
    const result = await sendWithStandardsSDKPattern(client, outboundTopicId, testMessage, outboundSubmitKey);
    testResults.push({
      test: 'Standards SDK pattern - Outbound Topic (with submit key)',
      success: true,
      transactionId: result.transactionId
    });
    console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
  } catch (error) {
    testResults.push({
      test: 'Standards SDK pattern - Outbound Topic (with submit key)',
      success: false,
      error: error.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  // Test 2: Standards SDK pattern for a topic WITHOUT submit key (inbound)
  console.log('\n🧪 Test 2: Standards SDK pattern for inbound topic (NO submit key)');
  try {
    const result = await sendWithStandardsSDKPattern(client, inboundTopicId, testMessage, null);
    testResults.push({
      test: 'Standards SDK pattern - Inbound Topic (no submit key)',
      success: true,
      transactionId: result.transactionId
    });
    console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
  } catch (error) {
    testResults.push({
      test: 'Standards SDK pattern - Inbound Topic (no submit key)',
      success: false,
      error: error.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  // Test 3: Our current implementation pattern for outbound topic
  console.log('\n🧪 Test 3: Our implementation pattern for outbound topic');
  try {
    const result = await sendWithOurPattern(client, outboundTopicId, testMessage);
    testResults.push({
      test: 'Our pattern - Outbound Topic',
      success: true,
      transactionId: result.transactionId
    });
    console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
  } catch (error) {
    testResults.push({
      test: 'Our pattern - Outbound Topic',
      success: false,
      error: error.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  // Save results for analysis
  const outputFile = './standards-sdk-analysis.json';
  fs.writeFileSync(outputFile, JSON.stringify({
    topicInfo: topicInfos,
    testResults
  }, null, 2));
  console.log(`\n📊 Detailed results saved to ${outputFile}`);
  
  // Print summary
  console.log('\n📝 Results Summary:');
  console.log('--------------------------------------------------');
  console.log('Test                             | Result');
  console.log('--------------------------------------------------');
  
  for (const result of testResults) {
    const testPadded = result.test.padEnd(32);
    const resultText = result.success ? '✅ Success' : '❌ Failed';
    console.log(`${testPadded} | ${resultText}`);
  }
  
  console.log('--------------------------------------------------');
  
  // Analyze the results
  console.log('\n🔍 Key Findings:');
  
  if (testResults.every(r => r.success)) {
    console.log('✅ ALL TESTS PASSED: Both patterns work correctly for both topic types');
    console.log('This suggests our implementation CAN work correctly with both topics');
    console.log('The issue in production is likely related to context or timing differences');
  } else if (testResults[0].success && testResults[1].success && !testResults[2].success) {
    console.log('✅ Standards SDK pattern works for both topics');
    console.log('❌ Our pattern fails for the outbound topic');
    console.log('This confirms our implementation needs to be updated to match the Standards SDK pattern');
  } else {
    console.log('❓ Mixed results: Further investigation needed');
    testResults.forEach(r => {
      console.log(`- ${r.test}: ${r.success ? 'SUCCESS' : 'FAILURE'}`);
    });
  }
  
  console.log('\n🏁 Standards SDK analysis completed');
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
    
    // Create private key instance
    console.log('Creating private key instance...');
    const privateKey = PrivateKey.fromStringED25519(operatorKey);
    
    // Set operator for client
    client.setOperator(operatorId, privateKey);
    console.log('✅ Hedera client initialized successfully');
    
    return client;
  } catch (error) {
    console.error('❌ Error initializing client:', error);
    throw error;
  }
}

// Get topic info to determine submit key requirements
async function getTopicInfo(client) {
  try {
    console.log(`Fetching info for inbound topic ${inboundTopicId}...`);
    const inboundInfo = await new TopicInfoQuery()
      .setTopicId(inboundTopicId)
      .execute(client);
    
    console.log(`Fetching info for outbound topic ${outboundTopicId}...`);
    const outboundInfo = await new TopicInfoQuery()
      .setTopicId(outboundTopicId)
      .execute(client);
    
    return {
      inbound: {
        topicId: inboundInfo.topicId.toString(),
        adminKey: inboundInfo.adminKey?.toString() || null,
        submitKey: inboundInfo.submitKey?.toString() || null,
        memo: inboundInfo.topicMemo
      },
      outbound: {
        topicId: outboundInfo.topicId.toString(),
        adminKey: outboundInfo.adminKey?.toString() || null,
        submitKey: outboundInfo.submitKey?.toString() || null,
        memo: outboundInfo.topicMemo
      }
    };
  } catch (error) {
    console.error('Error fetching topic info:', error);
    throw error;
  }
}

// Create a test message
function createTestMessage() {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'StandardsSDKTest',
      content: 'Testing Standards SDK patterns for message submission',
      timestamp: new Date().toISOString()
    })
  });
}

// Standards SDK pattern implementation
async function sendWithStandardsSDKPattern(client, topicId, message, submitKey) {
  console.log('🔄 Using Standards SDK pattern');
  
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    let response;
    
    // Check if there's a submit key requirement
    if (submitKey) {
      console.log('Topic has submit key, using freeze+sign pattern');
      // Freeze transaction
      const frozenTx = await transaction.freezeWith(client);
      
      // Parse the submit key
      const submitKeyObj = PrivateKey.fromString(submitKey);
      
      // Sign with submit key
      const signedTx = await frozenTx.sign(submitKeyObj);
      
      // Execute signed transaction
      response = await signedTx.execute(client);
    } else {
      console.log('Topic has no submit key, using direct execute pattern');
      // Execute transaction directly
      response = await transaction.execute(client);
    }
    
    return {
      transactionId: response.transactionId.toString(),
      method: submitKey ? 'Standards SDK with Submit Key' : 'Standards SDK Direct Execute'
    };
  } catch (error) {
    console.error('Error in Standards SDK pattern:', error);
    throw error;
  }
}

// Our current implementation pattern
async function sendWithOurPattern(client, topicId, message) {
  console.log('🔄 Using our current implementation pattern');
  
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    // Execute directly always (simulating our current approach)
    const response = await transaction.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Our Direct Execute Pattern'
    };
  } catch (error) {
    console.error('Error in our pattern:', error);
    throw error;
  }
}

// Run the Standards SDK analysis
analyzeStandardsSDK()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
