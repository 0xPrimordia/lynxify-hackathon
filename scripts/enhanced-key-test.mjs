#!/usr/bin/env node
/**
 * Enhanced Key Test Script
 * 
 * This script tests various transaction signing approaches with both inbound and outbound topics
 * to verify the hypothesis that the outbound topic requires proper submit key inclusion in transactions.
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

// Main test runner
async function runEnhancedTest() {
  console.log('🧪 Starting Enhanced Key Test');
  console.log('This test will verify the submit key hypothesis for signature verification');
  
  // Initialize client
  console.log('🔄 Initializing Hedera client...');
  const client = initializeClient();
  
  // First, fetch topic information to get the submit keys
  console.log('🔄 Fetching topic information...');
  const topicInfos = await getTopicInfo(client);
  
  // Extract submit keys (likely same key for both topics)
  const inboundSubmitKey = topicInfos.inbound.submitKey;
  const outboundSubmitKey = topicInfos.outbound.submitKey;
  
  console.log('\n📊 Topic Submit Key Status:');
  console.log(`Inbound Topic (${inboundTopicId}): ${inboundSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  console.log(`Outbound Topic (${outboundTopicId}): ${outboundSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  
  // Prepare test message
  const testMessage = {
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'EnhancedKeyTest',
      content: 'Testing transaction signing with submit key hypothesis',
      timestamp: new Date().toISOString()
    })
  };
  const messageString = JSON.stringify(testMessage);
  
  // Run test scenarios
  const results = [];
  
  console.log('\n\n🧪 Test Scenario 1: Send to Inbound Topic with Direct Execute');
  try {
    const result = await sendWithDirectExecute(client, inboundTopicId, messageString);
    results.push({ 
      scenario: 'Inbound Topic - Direct Execute',
      topicId: inboundTopicId,
      success: true,
      transactionId: result.transactionId
    });
    console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
  } catch (error) {
    results.push({ 
      scenario: 'Inbound Topic - Direct Execute',
      topicId: inboundTopicId,
      success: false,
      error: error.toString(),
      status: error.status?.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n\n🧪 Test Scenario 2: Send to Outbound Topic with Direct Execute');
  try {
    const result = await sendWithDirectExecute(client, outboundTopicId, messageString);
    results.push({ 
      scenario: 'Outbound Topic - Direct Execute',
      topicId: outboundTopicId,
      success: true,
      transactionId: result.transactionId
    });
    console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
  } catch (error) {
    results.push({ 
      scenario: 'Outbound Topic - Direct Execute',
      topicId: outboundTopicId,
      success: false,
      error: error.toString(),
      status: error.status?.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n\n🧪 Test Scenario 3: Send to Outbound Topic with Freeze+Sign INCLUDING Submit Key');
  try {
    // Only run this test if we have a submit key for the outbound topic
    if (outboundSubmitKey) {
      const result = await sendWithSubmitKey(client, outboundTopicId, messageString, outboundSubmitKey);
      results.push({ 
        scenario: 'Outbound Topic - With Submit Key',
        topicId: outboundTopicId,
        success: true,
        transactionId: result.transactionId
      });
      console.log(`✅ Success! Transaction ID: ${result.transactionId}`);
    } else {
      console.log('⚠️ Skipping test as outbound topic has no submit key');
      results.push({ 
        scenario: 'Outbound Topic - With Submit Key',
        topicId: outboundTopicId,
        success: false,
        error: 'Skipped - No submit key found'
      });
    }
  } catch (error) {
    results.push({ 
      scenario: 'Outbound Topic - With Submit Key',
      topicId: outboundTopicId,
      success: false,
      error: error.toString(),
      status: error.status?.toString()
    });
    console.log(`❌ Failed! Error: ${error.toString()}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Print results summary
  console.log('\n📝 Results Summary:');
  console.log('--------------------------------------------------');
  console.log('Scenario                    | Topic    | Result');
  console.log('--------------------------------------------------');
  
  for (const result of results) {
    const scenarioPadded = result.scenario.padEnd(28);
    const topicPadded = (result.topicId === inboundTopicId ? 'Inbound' : 'Outbound').padEnd(9);
    const resultText = result.success ? '✅ Success' : `❌ ${result.status || 'Failed'}`;
    console.log(`${scenarioPadded} | ${topicPadded} | ${resultText}`);
  }
  
  console.log('--------------------------------------------------');
  
  // Save results for HashScan verification
  const outputFile = './enhanced-key-test-results.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n📊 Detailed results saved to ${outputFile}`);
  
  // Print key findings
  console.log('\n🔍 Key Findings:');
  const inboundResult = results.find(r => r.scenario === 'Inbound Topic - Direct Execute');
  const outboundDirectResult = results.find(r => r.scenario === 'Outbound Topic - Direct Execute');
  const outboundWithKeyResult = results.find(r => r.scenario === 'Outbound Topic - With Submit Key');
  
  console.log('1. Inbound Topic (no submit key):');
  console.log(`   ${inboundResult.success ? '✅ SUCCESS' : '❌ FAILURE'} with direct execute`);
  
  console.log('2. Outbound Topic (with submit key):');
  console.log(`   ${outboundDirectResult.success ? '✅ SUCCESS' : '❌ FAILURE'} with direct execute`);
  console.log(`   ${outboundWithKeyResult.success ? '✅ SUCCESS' : '❌ FAILURE'} with explicit submit key`);
  
  if (inboundResult.success && !outboundDirectResult.success && outboundWithKeyResult.success) {
    console.log('\n✅ HYPOTHESIS CONFIRMED: The outbound topic requires proper submit key signing.');
    console.log('This confirms our finding that the INVALID_SIGNATURE errors are due to submit key requirements.');
  } else if (inboundResult.success && outboundDirectResult.success) {
    console.log('\n⚠️ MIXED RESULTS: Both topics worked with direct execute.');
    console.log('This suggests that the client may be handling submit keys automatically in some cases.');
  } else {
    console.log('\n❓ INCONCLUSIVE: Pattern did not match our hypothesis.');
    console.log('Review the detailed results for more information.');
  }
  
  console.log('\n🏁 Enhanced key test completed');
  console.log('Use the transaction IDs saved in the results file to examine details on HashScan.');
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

// Send message with direct execute (no explicit submit key handling)
async function sendWithDirectExecute(client, topicId, message) {
  console.log('🔄 Using direct execute approach (no explicit submit key handling)');
  
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    // Execute directly (without freeze/sign)
    console.log('Executing transaction directly...');
    const response = await transaction.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Direct Execute'
    };
  } catch (error) {
    console.error('Error in sendWithDirectExecute:', error);
    throw error;
  }
}

// Send message with proper submit key handling
async function sendWithSubmitKey(client, topicId, message, submitKeyString) {
  console.log('🔄 Using freeze+sign approach WITH explicit submit key');
  
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    // Freeze transaction
    console.log('Freezing transaction...');
    const frozenTx = await transaction.freezeWith(client);
    
    // Parse the submit key
    console.log('Parsing submit key for signing...');
    const submitKey = PrivateKey.fromString(submitKeyString);
    
    // Sign with submit key
    console.log('Signing transaction with submit key...');
    const signedTx = await frozenTx.sign(submitKey);
    
    // Execute signed transaction
    console.log('Executing signed transaction...');
    const response = await signedTx.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'With Submit Key'
    };
  } catch (error) {
    console.error('Error in sendWithSubmitKey:', error);
    throw error;
  }
}

// Run the enhanced key test
runEnhancedTest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
