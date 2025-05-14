#!/usr/bin/env node

/**
 * Direct Test Protocol Hypothesis Script
 * 
 * This script tests our hypothesis about different HCS-10
 * topic types directly using the Hedera SDK.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, AccountId, PrivateKey, TopicId, TopicInfoQuery, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

// Setup paths for Node ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('🚀 Starting Direct Protocol Hypothesis Test');
console.log('This script tests our hypothesis about HCS-10 protocol design requirements');

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

// Create a test message with identifying information
function createTestMessage(topicId, index) {
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
        testRun: 'protocol-hypothesis-direct',
        index: index
      }
    })
  });
}

/**
 * Class that implements the core logic from our HederaHCS10Client
 * but directly in JavaScript to test our hypothesis
 */
class DirectImplementationTester {
  constructor(config) {
    this.config = config;
    this.client = Client.forTestnet();
    this.operatorPrivateKey = PrivateKey.fromString(config.operatorPrivateKey);
    this.client.setOperator(config.operatorId, this.operatorPrivateKey);
    this.topicInfoCache = new Map();
    
    console.log(`🔄 Initialized DirectImplementationTester for ${config.network}`);
  }
  
  /**
   * Gets topic information directly using the Hedera SDK
   */
  async getTopicInfo(topicId) {
    try {
      // Check cache first
      if (this.topicInfoCache.has(topicId)) {
        const cachedInfo = this.topicInfoCache.get(topicId);
        console.log(`🔄 Using cached topic info for ${topicId}`);
        return cachedInfo;
      }

      console.log(`🔍 Fetching topic info for ${topicId}...`);
      
      // Query the topic information
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(topicId))
        .execute(this.client);
      
      // Extract keys
      const submitKey = topicInfo.submitKey ? topicInfo.submitKey.toString() : null;
      const adminKey = topicInfo.adminKey ? topicInfo.adminKey.toString() : null;
      
      // Cache the result
      const result = { submitKey, adminKey };
      this.topicInfoCache.set(topicId, result);
      
      console.log(`ℹ️ Topic ${topicId} info:
      - Submit key: ${submitKey ? 'PRESENT' : 'NONE'}
      - Admin key: ${adminKey ? 'PRESENT' : 'NONE'}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error fetching topic info for ${topicId}:`, error);
      throw error;
    }
  }
  
  /**
   * Sends a message to a topic using the correct pattern based on topic type
   */
  async sendMessage(topicId, message) {
    try {
      console.log(`📤 Sending message to topic ${topicId}...`);
      console.log(`📏 Message length: ${message.length} bytes`);
      
      // Create transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);
      
      // Get topic info to check for submit key requirement
      const topicInfo = await this.getTopicInfo(topicId);
      
      let response;
      
      // Use the correct transaction pattern based on topic type
      if (topicInfo.submitKey) {
        // This is a secured topic (like outbound) - needs submit key
        console.log(`🔒 Topic ${topicId} requires submit key - using freeze+sign pattern`);
        
        // Freeze the transaction
        const frozenTx = await transaction.freezeWith(this.client);
        
        // Get the submit key if it exists
        if (topicInfo.submitKey === this.config.operatorPrivateKey) {
          // If the submit key is our operator key, use that
          console.log(`🔑 Using operator key as submit key`);
          const signedTx = await frozenTx.sign(this.operatorPrivateKey);
          response = await signedTx.execute(this.client);
        } else {
          // Otherwise, try to use the submit key directly
          console.log(`🔑 Using topic's submit key`);
          const submitKeyObj = PrivateKey.fromString(topicInfo.submitKey);
          const signedTx = await frozenTx.sign(submitKeyObj);
          response = await signedTx.execute(this.client);
        }
      } else {
        // This is an unsecured topic (like inbound) - direct execution
        console.log(`🔓 Topic ${topicId} does not require submit key - using direct execute pattern`);
        response = await transaction.execute(this.client);
      }
      
      // Wait for receipt
      const receipt = await response.getReceipt(this.client);
      
      console.log(`✅ Message successfully sent to topic ${topicId}`);
      console.log(`📝 Transaction ID: ${response.transactionId.toString()}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending message to topic ${topicId}:`, error);
      
      if (error && typeof error === 'object' && 'status' in error) {
        console.error(`📊 Error status: ${error.status.toString()}`);
      }
      
      return { success: false, error: error.toString() };
    }
  }
}

// Main test function
async function runTests() {
  console.log('\n🧪 BEGINNING TESTS');
  
  // Initialize tester
  const tester = new DirectImplementationTester({
    network: networkName,
    operatorId,
    operatorPrivateKey: operatorKey,
    inboundTopicId,
    outboundTopicId
  });
  
  // Track results
  const results = {
    inbound: { success: 0, failure: 0, transactions: [] },
    outbound: { success: 0, failure: 0, transactions: [] },
    topicInfo: {}
  };
  
  // 1. First get topic info to verify our hypothesis about submit keys
  console.log('\n📊 Retrieving topic information to verify configuration...');
  
  try {
    const inboundInfo = await tester.getTopicInfo(inboundTopicId);
    results.topicInfo.inbound = inboundInfo;
    
    const outboundInfo = await tester.getTopicInfo(outboundTopicId);
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
      const result = await tester.sendMessage(inboundTopicId, message);
      
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
          error: result.error,
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
      const result = await tester.sendMessage(outboundTopicId, message);
      
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
          error: result.error,
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
  const filePath = path.join(projectRoot, `direct-protocol-results-${timestamp}.json`);
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

// 5. Run the tests
runTests().catch(error => {
  console.error('❌ Error in test execution:', error);
  process.exit(1);
}); 