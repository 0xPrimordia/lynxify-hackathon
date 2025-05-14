#!/usr/bin/env node

/**
 * Verify HCS10 Fix Test Script
 * 
 * This script tests our fix for the INVALID_SIGNATURE errors 
 * by sending messages to both inbound and outbound topics.
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

console.log('🚀 Starting Verify HCS10 Fix Test');
console.log('This script verifies that our fix for submit key handling is working properly');

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
      type: 'FixVerificationTest',
      id: `test-${Date.now()}-${index}`,
      sender: 'fix-verification-test',
      timestamp: Date.now(),
      details: {
        targetTopic: topicId,
        testRun: 'fix-verification',
        index: index
      }
    })
  });
}

/**
 * Implementation of the fixed HederaHCS10Client logic
 * This replicates our fix in src/lib/hedera-hcs10-client.ts
 */
class FixedHederaClient {
  constructor(config) {
    this.config = config;
    this.client = Client.forTestnet();
    this.operatorPrivateKey = PrivateKey.fromString(config.operatorPrivateKey);
    this.client.setOperator(config.operatorId, this.operatorPrivateKey);
    this.topicInfoCache = new Map();
    
    console.log(`🔄 Initialized FixedHederaClient for ${config.network}`);
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
   * Sends a message to a topic using our fixed approach
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
        
        // IMPORTANT: We must use our operator's private key for signing
        // The submitKey from topic info is the PUBLIC key, not the private key
        console.log(`🔑 Signing with operator's private key for submit key authorized topic`);
        
        // Sign with our operator's private key
        const signedTx = await frozenTx.sign(this.operatorPrivateKey);
        
        // Now execute the signed transaction
        console.log(`🔏 Executing signed transaction`);
        response = await signedTx.execute(this.client);
      } else {
        // This is an unsecured topic (like inbound) - direct execution
        console.log(`🔓 Topic ${topicId} does not require submit key - using direct execute pattern`);
        response = await transaction.execute(this.client);
      }
      
      // Wait for receipt
      const receipt = await response.getReceipt(this.client);
      
      console.log(`✅ Message successfully sent to topic ${topicId}`);
      console.log(`📝 Transaction ID: ${response.transactionId.toString()}`);
      
      return { success: true, transactionId: response.transactionId.toString() };
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
  
  // Initialize client with our fix
  const client = new FixedHederaClient({
    network: networkName,
    operatorId,
    operatorPrivateKey: operatorKey
  });
  
  // Track results
  const results = {
    inbound: { success: 0, failure: 0, transactions: [] },
    outbound: { success: 0, failure: 0, transactions: [] },
    topicInfo: {}
  };
  
  // 1. First get topic info to verify configurations
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
          transactionId: result.transactionId,
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
  
  // 3. Test outbound topic (requires freeze+sign with operator's private key)
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
          transactionId: result.transactionId,
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
  const filePath = path.join(projectRoot, `fix-verification-results-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to ${filePath}`);
  
  // 6. Verification summary
  console.log('\n🔍 FIX VERIFICATION SUMMARY:');
  
  if (results.inbound.success > 0 && results.outbound.success > 0) {
    console.log('✅ VERIFICATION SUCCESSFUL: Fix works for both inbound and outbound topics!');
    console.log('The implementation properly handles different transaction patterns based on topic submit key requirements.');
  } else if (results.inbound.success > 0) {
    console.log('⚠️ PARTIAL SUCCESS: Fix works for inbound topic but not for outbound topic.');
    console.log('The direct execute pattern works, but there might still be issues with the freeze+sign pattern.');
  } else if (results.outbound.success > 0) {
    console.log('⚠️ PARTIAL SUCCESS: Fix works for outbound topic but not for inbound topic.');
    console.log('This is unusual - the inbound topic should be easier to send to than the outbound topic.');
  } else {
    console.log('❌ VERIFICATION FAILED: Fix doesn\'t work for either topic.');
    console.log('There might be underlying issues with the client configuration or network connectivity.');
  }
  
  console.log('\n🏁 Fix verification testing completed');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Error in test execution:', error);
  process.exit(1);
}); 