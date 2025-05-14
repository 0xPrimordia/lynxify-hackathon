#!/usr/bin/env node
/**
 * Prototype Agent Implementation
 * 
 * This script demonstrates a corrected agent implementation that properly handles
 * submit keys for different topics based on their requirements.
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

/**
 * ProtoypeHederaService - A corrected implementation
 * 
 * This class demonstrates how to properly handle submit key requirements
 * for different topics using the Standards SDK pattern.
 */
class PrototypeHederaService {
  constructor() {
    this.client = null;
    this.operatorId = operatorId;
    this.operatorKey = operatorKey;
    this.topicCache = new Map(); // Cache topic info to avoid repeated queries
  }
  
  async initialize() {
    try {
      // Create client for the specified network
      if (networkName === 'testnet') {
        this.client = Client.forTestnet();
      } else if (networkName === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        throw new Error(`Unknown network: ${networkName}`);
      }
      
      // Create private key instance
      const privateKey = PrivateKey.fromStringED25519(this.operatorKey);
      
      // Set operator for client
      this.client.setOperator(this.operatorId, privateKey);
      console.log('✅ Hedera client initialized successfully');
      
      // Pre-fetch topic information to cache submit key requirements
      await this.getTopicInfo(inboundTopicId);
      await this.getTopicInfo(outboundTopicId);
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing PrototypeHederaService:', error);
      throw error;
    }
  }
  
  /**
   * Get information about a topic, including its submit key requirements
   * Caches results to avoid repeated network calls
   */
  async getTopicInfo(topicId) {
    // Check cache first
    if (this.topicCache.has(topicId)) {
      return this.topicCache.get(topicId);
    }
    
    try {
      console.log(`Fetching info for topic ${topicId}...`);
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(topicId)
        .execute(this.client);
      
      const info = {
        topicId: topicInfo.topicId.toString(),
        adminKey: topicInfo.adminKey?.toString() || null,
        submitKey: topicInfo.submitKey?.toString() || null,
        memo: topicInfo.topicMemo
      };
      
      // Cache the result
      this.topicCache.set(topicId, info);
      
      return info;
    } catch (error) {
      console.error(`Error fetching info for topic ${topicId}:`, error);
      throw error;
    }
  }
  
  /**
   * Publish a message to a topic with proper submit key handling
   * This is the key method that demonstrates the correct pattern
   */
  async publishMessage(topicId, message) {
    try {
      console.log(`Publishing message to topic ${topicId}...`);
      
      // Get topic info to check for submit key
      const topicInfo = await this.getTopicInfo(topicId);
      const submitKey = topicInfo.submitKey;
      
      // Create transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(message)
        .setMaxTransactionFee(new Hbar(10));
      
      let response;
      
      // Handle differently based on submit key requirement
      if (submitKey) {
        console.log('Topic has submit key, using freeze+sign pattern');
        // Freeze transaction
        const frozenTx = await transaction.freezeWith(this.client);
        
        // Parse the submit key
        const submitKeyObj = PrivateKey.fromString(submitKey);
        
        // Sign with submit key
        const signedTx = await frozenTx.sign(submitKeyObj);
        
        // Execute signed transaction
        response = await signedTx.execute(this.client);
      } else {
        console.log('Topic has no submit key, using direct execute pattern');
        // Execute transaction directly
        response = await transaction.execute(this.client);
      }
      
      const result = {
        transactionId: response.transactionId.toString(),
        topicId,
        submitKeyRequired: !!submitKey
      };
      
      console.log(`✅ Message published to topic ${topicId}`);
      console.log(`Transaction ID: ${result.transactionId}`);
      
      return result;
    } catch (error) {
      console.error(`Error publishing message to topic ${topicId}:`, error);
      throw error;
    }
  }
}

/**
 * Main function to run a demonstration of the prototype implementation
 */
async function runPrototypeDemo() {
  console.log('🚀 Starting Prototype Agent Implementation Demo');
  
  try {
    // Initialize the prototype service
    const prototypeService = new PrototypeHederaService();
    await prototypeService.initialize();
    
    // Create test messages
    const testMessageInbound = JSON.stringify({
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify({
        type: 'PrototypeTest',
        content: 'Testing corrected implementation - Inbound Message',
        timestamp: new Date().toISOString()
      })
    });
    
    const testMessageOutbound = JSON.stringify({
      p: 'hcs-10',
      op: 'message',
      data: JSON.stringify({
        type: 'PrototypeTest',
        content: 'Testing corrected implementation - Outbound Message',
        timestamp: new Date().toISOString()
      })
    });
    
    // Send messages
    console.log('\n🧪 Test 1: Sending message to inbound topic');
    const inboundResult = await prototypeService.publishMessage(inboundTopicId, testMessageInbound);
    
    console.log('\n🧪 Test 2: Sending message to outbound topic');
    const outboundResult = await prototypeService.publishMessage(outboundTopicId, testMessageOutbound);
    
    // Save results
    const results = {
      inbound: inboundResult,
      outbound: outboundResult
    };
    
    const outputFile = './prototype-implementation-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n📊 Results saved to ${outputFile}`);
    
    // Summary
    console.log('\n📝 Results Summary:');
    console.log('--------------------------------------------------');
    console.log(`Inbound Topic (${inboundTopicId}): ✅ SUCCESS`);
    console.log(`Submit Key Required: ${inboundResult.submitKeyRequired ? 'YES' : 'NO'}`);
    console.log(`Transaction ID: ${inboundResult.transactionId}`);
    console.log('--------------------------------------------------');
    console.log(`Outbound Topic (${outboundTopicId}): ✅ SUCCESS`);
    console.log(`Submit Key Required: ${outboundResult.submitKeyRequired ? 'YES' : 'NO'}`);
    console.log(`Transaction ID: ${outboundResult.transactionId}`);
    console.log('--------------------------------------------------');
    
    console.log('\n🏁 Prototype implementation demo completed');
    console.log('This demonstrates that with proper submit key handling, we can reliably send to both topics.');
    
  } catch (error) {
    console.error('❌ Error in prototype demo:', error);
  }
}

// Run the prototype demo
runPrototypeDemo()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
