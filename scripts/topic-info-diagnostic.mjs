#!/usr/bin/env node

/**
 * Topic Info Diagnostic Tool
 * 
 * This script checks the configuration of both inbound and outbound topics
 * to verify submit key requirements and other properties.
 */

import dotenv from 'dotenv';
import * as fs from 'node:fs';
import { Client, PrivateKey, TopicInfoQuery, TopicId } from '@hashgraph/sdk';

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

console.log('🔍 Topic Info Diagnostic Tool');
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
 * Get and display detailed topic information
 * @param {string} topicId The topic ID to query
 * @param {Client} client The Hedera client
 */
async function getTopicInfo(topicId, client) {
  console.log(`\n🔄 Fetching info for topic ${topicId}...`);
  
  try {
    // Query the topic information
    const info = await new TopicInfoQuery()
      .setTopicId(TopicId.fromString(topicId))
      .execute(client);
    
    console.log(`\n📊 Topic ${topicId} Configuration:`);
    console.log(`- Submit Key: ${info.submitKey ? 'PRESENT ✓' : 'NONE ✗'}`);
    console.log(`- Admin Key: ${info.adminKey ? 'PRESENT ✓' : 'NONE ✗'}`);
    console.log(`- Topic Memo: "${info.topicMemo}"`);
    console.log(`- Auto Renew Period: ${info.autoRenewPeriod.seconds}`);
    console.log(`- Expiration Time: ${info.expirationTime.toDate()}`);
    
    // Display key details if present
    if (info.submitKey) {
      console.log(`\n🔑 Submit Key Details:`);
      console.log(`- Key Type: ${info.submitKey.toString().includes('ed25519') ? 'ED25519' : 'OTHER'}`);
      console.log(`- Key String: ${info.submitKey.toString().substring(0, 20)}...`);
    }
    
    if (info.adminKey) {
      console.log(`\n👑 Admin Key Details:`);
      console.log(`- Key Type: ${info.adminKey.toString().includes('ed25519') ? 'ED25519' : 'OTHER'}`);
      console.log(`- Key String: ${info.adminKey.toString().substring(0, 20)}...`);
    }
    
    return info;
  } catch (error) {
    console.error(`❌ Error fetching info for topic ${topicId}:`, error);
    return null;
  }
}

/**
 * Main function to run the diagnostic
 */
async function runDiagnostic() {
  try {
    // Initialize Hedera client
    console.log(`\n🔄 Initializing Hedera client for ${networkName}...`);
    
    const client = networkName === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    // Create private key from string
    const privateKey = PrivateKey.fromString(operatorKey);
    
    // Set operator
    client.setOperator(operatorId, privateKey);
    console.log('✅ Client initialized successfully');
    
    // Test the inbound topic
    const inboundInfo = await getTopicInfo(inboundTopicId, client);
    
    // Test the outbound topic
    const outboundInfo = await getTopicInfo(outboundTopicId, client);
    
    // Display summary comparison
    console.log('\n📋 Topic Comparison Summary:');
    console.log('┌─────────────────┬───────────────────┬───────────────────┐');
    console.log('│ Property        │ Inbound Topic     │ Outbound Topic    │');
    console.log('├─────────────────┼───────────────────┼───────────────────┤');
    console.log(`│ Topic ID        │ ${inboundTopicId.padEnd(17)} │ ${outboundTopicId.padEnd(17)} │`);
    console.log(`│ Submit Key      │ ${(inboundInfo?.submitKey ? 'PRESENT' : 'NONE').padEnd(17)} │ ${(outboundInfo?.submitKey ? 'PRESENT' : 'NONE').padEnd(17)} │`);
    console.log(`│ Admin Key       │ ${(inboundInfo?.adminKey ? 'PRESENT' : 'NONE').padEnd(17)} │ ${(outboundInfo?.adminKey ? 'PRESENT' : 'NONE').padEnd(17)} │`);
    console.log('└─────────────────┴───────────────────┴───────────────────┘');
    
    // Write results to a file for reference
    const results = {
      inboundTopic: {
        id: inboundTopicId,
        hasSubmitKey: !!inboundInfo?.submitKey,
        hasAdminKey: !!inboundInfo?.adminKey,
        memo: inboundInfo?.topicMemo,
        submitKeyType: inboundInfo?.submitKey ? inboundInfo.submitKey.toString().substring(0, 30) : null
      },
      outboundTopic: {
        id: outboundTopicId,
        hasSubmitKey: !!outboundInfo?.submitKey,
        hasAdminKey: !!outboundInfo?.adminKey,
        memo: outboundInfo?.topicMemo,
        submitKeyType: outboundInfo?.submitKey ? outboundInfo.submitKey.toString().substring(0, 30) : null
      },
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('topic-info-results.json', JSON.stringify(results, null, 2));
    console.log('✅ Results saved to topic-info-results.json');
    
  } catch (error) {
    console.error('❌ Error running diagnostic:', error);
  }
}

// Run the diagnostic
runDiagnostic().then(() => {
  console.log('\n✅ Diagnostic complete');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 