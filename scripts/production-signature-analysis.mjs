#!/usr/bin/env node
/**
 * Production Signature Analysis Script
 * 
 * This script tests multiple messages in quick succession to both topics
 * to identify patterns that might explain the inconsistent behavior seen in production.
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
async function runProductionAnalysis() {
  console.log('🧪 Starting Production Signature Analysis');
  console.log('This test will send multiple messages in rapid succession to simulate production loads');
  
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
  
  // Configure test parameters
  const numMessages = 20; // Send 20 messages per topic
  const concurrency = 5;  // Send 5 at a time
  const delayBetweenBatches = 500; // 500ms between batches
  
  const testSuites = [
    {
      name: 'Inbound Topic - Direct Execute',
      topicId: inboundTopicId,
      method: 'directExecute'
    },
    {
      name: 'Outbound Topic - Direct Execute',
      topicId: outboundTopicId,
      method: 'directExecute'
    },
    {
      name: 'Outbound Topic - With Submit Key',
      topicId: outboundTopicId,
      method: 'withSubmitKey',
      submitKey: outboundSubmitKey
    }
  ];
  
  // Store results
  const results = [];
  
  // Run tests for each suite
  for (const suite of testSuites) {
    console.log(`\n\n🧪 Running test suite: ${suite.name}`);
    console.log(`Sending ${numMessages} messages in batches of ${concurrency}`);
    
    const suiteResults = [];
    
    // Send messages in batches
    for (let i = 0; i < numMessages; i += concurrency) {
      const batch = [];
      
      // Create batch of promises
      for (let j = 0; j < concurrency && i + j < numMessages; j++) {
        const messageNum = i + j;
        const message = createTestMessage(messageNum, suite.name);
        
        // Create appropriate send function based on method
        let sendPromise;
        if (suite.method === 'directExecute') {
          sendPromise = sendWithDirectExecute(client, suite.topicId, message)
            .then(result => ({ messageNum, success: true, ...result }))
            .catch(error => ({ messageNum, success: false, error: error.toString(), status: error.status?.toString() }));
        } else if (suite.method === 'withSubmitKey' && suite.submitKey) {
          sendPromise = sendWithSubmitKey(client, suite.topicId, message, suite.submitKey)
            .then(result => ({ messageNum, success: true, ...result }))
            .catch(error => ({ messageNum, success: false, error: error.toString(), status: error.status?.toString() }));
        }
        
        batch.push(sendPromise);
      }
      
      // Wait for batch to complete
      console.log(`Sending batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(numMessages/concurrency)}...`);
      const batchResults = await Promise.all(batch);
      suiteResults.push(...batchResults);
      
      // Summarize batch results
      const successCount = batchResults.filter(r => r.success).length;
      console.log(`Batch results: ${successCount}/${batchResults.length} successful`);
      
      // Wait between batches
      if (i + concurrency < numMessages) {
        console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    // Add to overall results
    results.push({
      suite: suite.name,
      results: suiteResults,
      successCount: suiteResults.filter(r => r.success).length,
      failureCount: suiteResults.filter(r => !r.success).length
    });
    
    // Print suite summary
    const successCount = suiteResults.filter(r => r.success).length;
    console.log(`\n📊 ${suite.name} Summary:`);
    console.log(`${successCount}/${suiteResults.length} messages successful (${Math.round(successCount/suiteResults.length*100)}%)`);
    
    if (suiteResults.some(r => !r.success)) {
      console.log('\nError samples:');
      const failures = suiteResults.filter(r => !r.success).slice(0, 3);
      failures.forEach(failure => {
        console.log(`- Message ${failure.messageNum}: ${failure.status || failure.error}`);
      });
    }
  }
  
  // Print overall results
  console.log('\n\n📝 Overall Results:');
  console.log('--------------------------------------------------');
  console.log('Test Suite                  | Success | Failure | Success %');
  console.log('--------------------------------------------------');
  
  for (const suite of results) {
    const successPercent = Math.round(suite.successCount / (suite.successCount + suite.failureCount) * 100);
    const suitePadded = suite.suite.padEnd(28);
    console.log(`${suitePadded} | ${String(suite.successCount).padEnd(7)} | ${String(suite.failureCount).padEnd(7)} | ${successPercent}%`);
  }
  
  console.log('--------------------------------------------------');
  
  // Save results for analysis
  const outputFile = './production-signature-analysis.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n📊 Detailed results saved to ${outputFile}`);
  
  // Analyze patterns
  console.log('\n🔍 Pattern Analysis:');
  
  // Compare success rates
  const inboundDirectRate = results.find(r => r.suite === 'Inbound Topic - Direct Execute')?.successCount / numMessages * 100 || 0;
  const outboundDirectRate = results.find(r => r.suite === 'Outbound Topic - Direct Execute')?.successCount / numMessages * 100 || 0;
  const outboundWithKeyRate = results.find(r => r.suite === 'Outbound Topic - With Submit Key')?.successCount / numMessages * 100 || 0;
  
  console.log(`Inbound Topic Direct Execute Success Rate: ${inboundDirectRate.toFixed(1)}%`);
  console.log(`Outbound Topic Direct Execute Success Rate: ${outboundDirectRate.toFixed(1)}%`);
  console.log(`Outbound Topic With Submit Key Success Rate: ${outboundWithKeyRate.toFixed(1)}%`);
  
  // Identify patterns in timing
  const inboundResults = results.find(r => r.suite === 'Inbound Topic - Direct Execute')?.results || [];
  const outboundResults = results.find(r => r.suite === 'Outbound Topic - Direct Execute')?.results || [];
  
  // Check for batch-based patterns (first message in batch vs others)
  const firstInBatchInbound = inboundResults.filter((_, i) => i % concurrency === 0);
  const otherInBatchInbound = inboundResults.filter((_, i) => i % concurrency !== 0);
  const firstInBatchOutbound = outboundResults.filter((_, i) => i % concurrency === 0);
  const otherInBatchOutbound = outboundResults.filter((_, i) => i % concurrency !== 0);
  
  const firstInboundSuccessRate = firstInBatchInbound.filter(r => r.success).length / firstInBatchInbound.length * 100;
  const otherInboundSuccessRate = otherInBatchInbound.filter(r => r.success).length / otherInBatchInbound.length * 100;
  const firstOutboundSuccessRate = firstInBatchOutbound.filter(r => r.success).length / firstInBatchOutbound.length * 100;
  const otherOutboundSuccessRate = otherInBatchOutbound.filter(r => r.success).length / otherInBatchOutbound.length * 100;
  
  console.log('\n📊 Batch Position Analysis:');
  console.log(`Inbound Topic - First message in batch success rate: ${firstInboundSuccessRate.toFixed(1)}%`);
  console.log(`Inbound Topic - Other messages in batch success rate: ${otherInboundSuccessRate.toFixed(1)}%`);
  console.log(`Outbound Topic - First message in batch success rate: ${firstOutboundSuccessRate.toFixed(1)}%`);
  console.log(`Outbound Topic - Other messages in batch success rate: ${otherOutboundSuccessRate.toFixed(1)}%`);
  
  if (Math.abs(firstOutboundSuccessRate - otherOutboundSuccessRate) > 20) {
    console.log('\n⚠️ Significant difference in success rates based on batch position for outbound topic!');
    console.log('This suggests that client state or concurrency affects signature validation.');
  }
  
  console.log('\n🏁 Production signature analysis completed');
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

// Create a test message with varying content
function createTestMessage(messageNumber, suite) {
  // Create a message with varied content to test if content affects signature verification
  const messageContent = `Test message ${messageNumber} for ${suite} at ${new Date().toISOString()}`;
  // Add some varied-length data to the message
  const padding = 'X'.repeat(messageNumber % 100);
  
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'ProductionSignatureTest',
      content: messageContent + padding,
      timestamp: Date.now(),
      messageNumber
    })
  });
}

// Send message with direct execute (no explicit submit key handling)
async function sendWithDirectExecute(client, topicId, message) {
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    // Execute directly (without freeze/sign)
    const response = await transaction.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'Direct Execute'
    };
  } catch (error) {
    console.error(`Error sending message to ${topicId} with direct execute: ${error.status?.toString() || error}`);
    throw error;
  }
}

// Send message with proper submit key handling
async function sendWithSubmitKey(client, topicId, message, submitKeyString) {
  try {
    // Create transaction
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(10));
    
    // Freeze transaction
    const frozenTx = await transaction.freezeWith(client);
    
    // Parse the submit key
    const submitKey = PrivateKey.fromString(submitKeyString);
    
    // Sign with submit key
    const signedTx = await frozenTx.sign(submitKey);
    
    // Execute signed transaction
    const response = await signedTx.execute(client);
    
    return {
      transactionId: response.transactionId.toString(),
      method: 'With Submit Key'
    };
  } catch (error) {
    console.error(`Error sending message to ${topicId} with submit key: ${error.status?.toString() || error}`);
    throw error;
  }
}

// Run the production analysis
runProductionAnalysis()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
