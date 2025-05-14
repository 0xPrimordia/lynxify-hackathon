#!/usr/bin/env node

/**
 * Test Protocol Hypothesis Script
 * 
 * This script tests our hypothesis about HCS-10 protocol requirements for
 * inbound vs outbound topics. It compiles our TypeScript implementation and
 * tests sending messages to both topic types with detailed logging.
 */

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('🚀 Starting Protocol Hypothesis Test');
console.log('This script will test our hypothesis about HCS-10 inbound vs outbound topic handling');

// 1. Load environment variables
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

// 2. Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || process.env.HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || process.env.HCS_OUTBOUND_TOPIC;
const networkName = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

// Validate environment variables
if (!operatorId || !operatorKey || !inboundTopicId || !outboundTopicId) {
  console.error('❌ Missing required environment variables. Please set the following:');
  console.error('- NEXT_PUBLIC_OPERATOR_ID/OPERATOR_ID');
  console.error('- OPERATOR_KEY');
  console.error('- NEXT_PUBLIC_HCS_INBOUND_TOPIC/HCS_INBOUND_TOPIC');
  console.error('- NEXT_PUBLIC_HCS_OUTBOUND_TOPIC/HCS_OUTBOUND_TOPIC');
  process.exit(1);
}

console.log('\n📌 Test Configuration:');
console.log(`- Operator ID: ${operatorId}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);
console.log(`- Network: ${networkName}`);

// 3. Compile TypeScript to ensure latest changes are included
console.log('\n🔄 Compiling TypeScript code...');
try {
  execSync('npm run build:hcs10-esm', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.error('❌ TypeScript compilation failed:', error.message);
  process.exit(1);
}

// 4. Import our HederaHCS10Client
console.log('\n🔄 Importing HederaHCS10Client...');
import('../dist-esm/src/lib/hedera-hcs10-client.js').then(async (module) => {
  const { HederaHCS10Client } = module;
  console.log('✅ HederaHCS10Client imported successfully');
  
  // 5. Run the tests
  await runTests(HederaHCS10Client);
}).catch(error => {
  console.error('❌ Error importing HederaHCS10Client:', error);
  process.exit(1);
});

// Create test message with identifying info
const createTestMessage = (topicId, index) => {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'ProtocolHypothesisTest',
      id: `test-${Date.now()}-${index}`,
      sender: 'protocol-hypothesis-test',
      timestamp: Date.now(),
      details: {
        targetTopic: topicId,
        testRun: 'protocol-hypothesis',
        index: index
      }
    })
  });
};

// Initialize the client
const initClient = (HederaHCS10Client) => {
  console.log('\n🔄 Initializing HederaHCS10Client...');
  
  const client = new HederaHCS10Client({
    network: networkName,
    operatorId,
    operatorPrivateKey: operatorKey,
    inboundTopicId,
    outboundTopicId
  });
  
  console.log('✅ HederaHCS10Client initialized');
  return client;
};

// Main test function
async function runTests(HederaHCS10Client) {
  console.log('\n🧪 BEGINNING TESTS');
  
  // Initialize client
  const client = initClient(HederaHCS10Client);
  
  // Track results
  const results = {
    inbound: { success: 0, failure: 0, transactions: [] },
    outbound: { success: 0, failure: 0, transactions: [] },
    topicInfo: {}
  };
  
  // 1. First get topic info to verify our hypothesis about submit keys
  console.log('\n📊 Retrieving topic information to verify configuration...');
  
  try {
    const inboundInfo = await client.getTopicInfo(inboundTopicId);
    results.topicInfo.inbound = inboundInfo;
    
    const outboundInfo = await client.getTopicInfo(outboundTopicId);
    results.topicInfo.outbound = outboundInfo;
    
    console.log('\n📌 Topic Configuration Summary:');
    console.log(`- Inbound Topic (${inboundTopicId}): Submit Key ${inboundInfo.submitKey ? 'PRESENT' : 'ABSENT'}`);
    console.log(`- Outbound Topic (${outboundTopicId}): Submit Key ${outboundInfo.submitKey ? 'PRESENT' : 'ABSENT'}`);
  } catch (error) {
    console.error('❌ Error retrieving topic information:', error);
    process.exit(1);
  }
  
  // 2. Test inbound topic (should work with direct execute)
  console.log('\n🧪 Testing Inbound Topic...');
  
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`\n🔄 Sending test message ${i+1} to inbound topic...`);
      const message = createTestMessage(inboundTopicId, i);
      const result = await client.sendMessage(inboundTopicId, message);
      
      if (result.success) {
        console.log(`✅ Message ${i+1} sent successfully to inbound topic`);
        results.inbound.success++;
        results.inbound.transactions.push({
          index: i,
          success: true,
          timestamp: Date.now()
        });
      } else {
        console.log(`❌ Message ${i+1} failed to send to inbound topic`);
        results.inbound.failure++;
        results.inbound.transactions.push({
          index: i,
          success: false,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`❌ Error sending message ${i+1} to inbound topic:`, error);
      results.inbound.failure++;
      results.inbound.transactions.push({
        index: i,
        success: false,
        error: error.toString(),
        timestamp: Date.now()
      });
    }
    
    // Wait a moment between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 3. Test outbound topic (may require freeze+sign pattern)
  console.log('\n🧪 Testing Outbound Topic...');
  
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`\n🔄 Sending test message ${i+1} to outbound topic...`);
      const message = createTestMessage(outboundTopicId, i);
      const result = await client.sendMessage(outboundTopicId, message);
      
      if (result.success) {
        console.log(`✅ Message ${i+1} sent successfully to outbound topic`);
        results.outbound.success++;
        results.outbound.transactions.push({
          index: i,
          success: true,
          timestamp: Date.now()
        });
      } else {
        console.log(`❌ Message ${i+1} failed to send to outbound topic`);
        results.outbound.failure++;
        results.outbound.transactions.push({
          index: i,
          success: false,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`❌ Error sending message ${i+1} to outbound topic:`, error);
      results.outbound.failure++;
      results.outbound.transactions.push({
        index: i,
        success: false,
        error: error.toString(),
        timestamp: Date.now()
      });
    }
    
    // Wait a moment between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 4. Output results
  console.log('\n📊 TEST RESULTS:');
  console.log('--------------------------------------------------');
  console.log(`Inbound Topic (${inboundTopicId}) - ${results.topicInfo.inbound.submitKey ? 'With' : 'Without'} Submit Key:`);
  console.log(`✅ Success: ${results.inbound.success}`);
  console.log(`❌ Failure: ${results.inbound.failure}`);
  console.log(`📊 Success Rate: ${(results.inbound.success / (results.inbound.success + results.inbound.failure) * 100).toFixed(2)}%`);
  
  console.log(`\nOutbound Topic (${outboundTopicId}) - ${results.topicInfo.outbound.submitKey ? 'With' : 'Without'} Submit Key:`);
  console.log(`✅ Success: ${results.outbound.success}`);
  console.log(`❌ Failure: ${results.outbound.failure}`);
  console.log(`📊 Success Rate: ${(results.outbound.success / (results.outbound.success + results.outbound.failure) * 100).toFixed(2)}%`);
  
  console.log('\nCOMBINED:');
  const totalSuccess = results.inbound.success + results.outbound.success;
  const totalFailure = results.inbound.failure + results.outbound.failure;
  console.log(`✅ Success: ${totalSuccess}`);
  console.log(`❌ Failure: ${totalFailure}`);
  console.log(`📊 Overall Success Rate: ${(totalSuccess / (totalSuccess + totalFailure) * 100).toFixed(2)}%`);
  console.log('--------------------------------------------------');
  
  // 5. Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = `./protocol-hypothesis-results-${timestamp}.json`;
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to ${filePath}`);
  
  // 6. Final summary and hypothesis validation
  console.log('\n🔍 HYPOTHESIS TESTING SUMMARY:');
  
  // Check if results match our hypothesis
  const inboundMatches = (results.topicInfo.inbound.submitKey === null && results.inbound.success > 0);
  const outboundMatches = (results.topicInfo.outbound.submitKey !== null);
  
  if (inboundMatches) {
    console.log('✅ CONFIRMED: Inbound topic has no submit key and works with direct execute pattern');
  } else {
    console.log('❌ MISMATCH: Inbound topic hypothesis needs revision');
  }
  
  if (outboundMatches) {
    if (results.outbound.success > 0) {
      console.log('✅ CONFIRMED: Outbound topic has submit key and our implementation correctly handles it');
    } else {
      console.log('⚠️ PARTIAL MATCH: Outbound topic has submit key but our implementation still has issues');
    }
  } else {
    console.log('❌ MISMATCH: Outbound topic does not match our hypothesis about submit keys');
  }
  
  console.log('\n🏁 Protocol hypothesis testing completed');
} 