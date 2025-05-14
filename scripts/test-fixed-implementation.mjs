#!/usr/bin/env node

/**
 * Test Fixed Implementation Script
 * 
 * This script tests our fixed implementation with both inbound and outbound topics
 * to verify that the INVALID_SIGNATURE errors are resolved.
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, AccountId, TopicId, TopicInfoQuery } from '@hashgraph/sdk';
import * as fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Define paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Explicitly import the file using relative path
import('../dist/src/lib/hedera-hcs10-client.js').then(module => {
  const { HederaHCS10Client } = module;
  runMain(HederaHCS10Client);
}).catch(error => {
  console.error('Error importing HederaHCS10Client:', error);
  process.exit(1);
});

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
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || process.env.HCS_INBOUND_TOPIC || '0.0.5966032';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || process.env.HCS_OUTBOUND_TOPIC || '0.0.5966031';

// Validate environment variables
if (!operatorId || !operatorKey) {
  console.error('❌ Missing required environment variables. Make sure OPERATOR_ID and OPERATOR_KEY are set.');
  process.exit(1);
}

// Output configuration
console.log('🔥 Running fixed implementation test with configuration:');
console.log(`   Operator ID: ${operatorId}`);
console.log(`   Inbound Topic: ${inboundTopicId}`);
console.log(`   Outbound Topic: ${outboundTopicId}`);

// Create a test message
const createTestMessage = (topicId, index) => {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'TestMessage',
      id: `test-${Date.now()}-${index}`,
      sender: 'fixed-implementation-test',
      timestamp: Date.now(),
      details: {
        targetTopic: topicId,
        testRun: 'fixed-implementation',
        index
      }
    })
  });
};

// Initialize the HCS10 client
const initClient = (HederaHCS10Client) => {
  console.log('🔄 Initializing HCS10 client...');
  
  const client = new HederaHCS10Client({
    network: 'testnet',
    operatorId,
    operatorPrivateKey: operatorKey,
    inboundTopicId,
    outboundTopicId
  });
  
  return client;
};

// Run tests against both topics
const runTests = async (HederaHCS10Client) => {
  const client = initClient(HederaHCS10Client);
  const results = {
    inbound: { success: 0, failure: 0 },
    outbound: { success: 0, failure: 0 },
    transactions: []
  };
  
  console.log('\n🧪 Running tests...');
  
  // Test inbound topic (no submit key)
  console.log('\n🔄 Testing Inbound Topic (no submit key)...');
  
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`   🔄 Sending test message ${i+1} to inbound topic...`);
      const message = createTestMessage(inboundTopicId, i);
      const result = await client.sendMessage(inboundTopicId, message);
      
      if (result.success) {
        console.log(`   ✅ Message ${i+1} sent successfully to inbound topic`);
        results.inbound.success++;
        results.transactions.push({
          topic: 'inbound',
          index: i,
          success: true
        });
      } else {
        console.log(`   ❌ Message ${i+1} failed to send to inbound topic`);
        results.inbound.failure++;
        results.transactions.push({
          topic: 'inbound',
          index: i,
          success: false
        });
      }
    } catch (error) {
      console.error(`   ❌ Error sending message ${i+1} to inbound topic:`, error);
      results.inbound.failure++;
      results.transactions.push({
        topic: 'inbound',
        index: i,
        success: false,
        error: error.toString()
      });
    }
  }
  
  // Test outbound topic (has submit key)
  console.log('\n🔄 Testing Outbound Topic (has submit key)...');
  
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`   🔄 Sending test message ${i+1} to outbound topic...`);
      const message = createTestMessage(outboundTopicId, i);
      const result = await client.sendMessage(outboundTopicId, message);
      
      if (result.success) {
        console.log(`   ✅ Message ${i+1} sent successfully to outbound topic`);
        results.outbound.success++;
        results.transactions.push({
          topic: 'outbound',
          index: i,
          success: true
        });
      } else {
        console.log(`   ❌ Message ${i+1} failed to send to outbound topic`);
        results.outbound.failure++;
        results.transactions.push({
          topic: 'outbound',
          index: i,
          success: false
        });
      }
    } catch (error) {
      console.error(`   ❌ Error sending message ${i+1} to outbound topic:`, error);
      results.outbound.failure++;
      results.transactions.push({
        topic: 'outbound',
        index: i,
        success: false,
        error: error.toString()
      });
    }
  }
  
  return results;
};

// Output results
const outputResults = (results) => {
  console.log('\n📊 TEST RESULTS:');
  console.log('================================================');
  console.log(`Inbound Topic (no submit key):`);
  console.log(`   ✅ Success: ${results.inbound.success}`);
  console.log(`   ❌ Failure: ${results.inbound.failure}`);
  console.log(`   📊 Success Rate: ${(results.inbound.success / (results.inbound.success + results.inbound.failure) * 100).toFixed(2)}%`);
  
  console.log('\nOutbound Topic (has submit key):');
  console.log(`   ✅ Success: ${results.outbound.success}`);
  console.log(`   ❌ Failure: ${results.outbound.failure}`);
  console.log(`   📊 Success Rate: ${(results.outbound.success / (results.outbound.success + results.outbound.failure) * 100).toFixed(2)}%`);
  
  console.log('\nCOMBINED:');
  const totalSuccess = results.inbound.success + results.outbound.success;
  const totalFailure = results.inbound.failure + results.outbound.failure;
  console.log(`   ✅ Success: ${totalSuccess}`);
  console.log(`   ❌ Failure: ${totalFailure}`);
  console.log(`   📊 Overall Success Rate: ${(totalSuccess / (totalSuccess + totalFailure) * 100).toFixed(2)}%`);
  console.log('================================================');
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = `./fixed-implementation-results-${timestamp}.json`;
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${filePath}`);
};

// Main function
const runMain = async (HederaHCS10Client) => {
  try {
    const results = await runTests(HederaHCS10Client);
    outputResults(results);
    
    // Output final status
    if (results.outbound.failure === 0 && results.inbound.failure === 0) {
      console.log('\n✅ SUCCESS: Fixed implementation is working correctly!');
      console.log('   All messages sent successfully to both topics');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Fixed implementation still has some issues');
      console.log('   Review the detailed results for more information');
    }
  } catch (error) {
    console.error('❌ Fatal error running tests:', error);
  }
};