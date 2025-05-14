#!/usr/bin/env node

/**
 * Direct Execute Test Script
 * 
 * This script tests sending messages to both inbound and outbound topics
 * using ONLY direct execute pattern (no freeze+sign) to narrow down the issue.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, TopicId, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

// Setup paths for Node ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('🚀 Starting Direct Execute Test');
console.log('This script attempts to send messages using only direct execution (no freeze+sign)');

// 1. Load environment variables
try {
  dotenv.config({ path: path.join(projectRoot, '.env.local') });
  console.log('✅ Loaded environment variables from .env.local');
} catch (error) {
  console.log('⚠️ Error loading environment variables:', error.message);
}

// 2. Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || process.env.HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || process.env.HCS_OUTBOUND_TOPIC;
const networkName = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

// 3. Validate environment variables
if (!operatorId || !operatorKey || !inboundTopicId || !outboundTopicId) {
  console.error('❌ Missing required environment variables.');
  process.exit(1);
}

console.log('\n📌 Test Configuration:');
console.log(`- Operator ID: ${operatorId}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);
console.log(`- Network: ${networkName}`);

// Create a test message
function createTestMessage(topicId, index) {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'DirectExecuteTest',
      id: `test-${Date.now()}-${index}`,
      timestamp: Date.now(),
      details: {
        targetTopic: topicId,
        testRun: 'direct-execute-only'
      }
    })
  });
}

// Main test function
async function runTests() {
  console.log('\n🧪 BEGINNING TESTS');
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  // Track results
  const results = {
    inbound: { success: 0, failure: 0 },
    outbound: { success: 0, failure: 0 }
  };
  
  // 1. Test inbound topic with direct execute (we know this works)
  console.log('\n🧪 Testing Inbound Topic with Direct Execute:');
  for (let i = 0; i < 2; i++) {
    try {
      console.log(`\n🔄 Sending test message ${i+1} to inbound topic...`);
      
      // Create and send transaction directly (no freeze+sign)
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(inboundTopicId))
        .setMessage(createTestMessage(inboundTopicId, i));
      
      console.log('▶️ Executing transaction directly (no freeze+sign)');
      const response = await transaction.execute(client);
      
      // Wait for receipt
      const receipt = await response.getReceipt(client);
      
      console.log(`✅ Message sent successfully to inbound topic`);
      console.log(`📝 Transaction ID: ${response.transactionId.toString()}`);
      results.inbound.success++;
    } catch (error) {
      console.error(`❌ Error sending to inbound topic:`, error);
      results.inbound.failure++;
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 2. Test outbound topic with direct execute (bypassing freeze+sign)
  console.log('\n🧪 Testing Outbound Topic with Direct Execute:');
  for (let i = 0; i < 2; i++) {
    try {
      console.log(`\n🔄 Sending test message ${i+1} to outbound topic...`);
      
      // Create and send transaction directly (no freeze+sign)
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(outboundTopicId))
        .setMessage(createTestMessage(outboundTopicId, i));
      
      console.log('▶️ Executing transaction directly (no freeze+sign)');
      const response = await transaction.execute(client);
      
      // Wait for receipt
      const receipt = await response.getReceipt(client);
      
      console.log(`✅ Message sent successfully to outbound topic`);
      console.log(`📝 Transaction ID: ${response.transactionId.toString()}`);
      results.outbound.success++;
    } catch (error) {
      console.error(`❌ Error sending to outbound topic:`, error);
      if (error && typeof error === 'object' && 'status' in error) {
        console.error(`📊 Error status: ${error.status.toString()}`);
      }
      results.outbound.failure++;
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Output results
  console.log('\n📊 TEST RESULTS:');
  console.log('--------------------------------------------------');
  console.log(`Inbound Topic (${inboundTopicId}) with Direct Execute:`);
  console.log(`✅ Success: ${results.inbound.success}`);
  console.log(`❌ Failure: ${results.inbound.failure}`);
  
  console.log(`\nOutbound Topic (${outboundTopicId}) with Direct Execute:`);
  console.log(`✅ Success: ${results.outbound.success}`);
  console.log(`❌ Failure: ${results.outbound.failure}`);
  console.log('--------------------------------------------------');
  
  // Summary
  if (results.outbound.success > 0) {
    console.log('\n🔍 IMPORTANT INSIGHT: Outbound topic does NOT require freeze+sign!');
    console.log('This contradicts our assumption - direct execution works for both topics.');
    console.log('We should modify our implementation to try direct execution first for all topics.');
  } else {
    console.log('\n🔍 ANALYSIS: Outbound topic validation fails regardless of pattern.');
    console.log('This suggests a deeper issue with permissions or topic configuration.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Error in test execution:', error);
  process.exit(1);
}); 