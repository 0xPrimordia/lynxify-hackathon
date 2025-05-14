#!/usr/bin/env node
/**
 * Topic Info Check
 * 
 * This script retrieves and compares the topic information for inbound and outbound topics
 * to help diagnose potential permission issues.
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'node:fs';
import { Client, PrivateKey, TopicInfoQuery } from '@hashgraph/sdk';

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

// Main function
async function checkTopicInfo() {
  console.log('🔍 Checking topic information from Mirror Node APIs');
  
  // Determine mirror node API URL based on network
  const mirrorBaseUrl = networkName === 'mainnet' 
    ? 'https://mainnet-public.mirrornode.hedera.com' 
    : 'https://testnet.mirrornode.hedera.com';
  
  console.log(`Using Mirror Node API: ${mirrorBaseUrl}`);
  
  // Fetch info for both topics
  const topics = [
    { name: 'Inbound Topic', id: inboundTopicId },
    { name: 'Outbound Topic', id: outboundTopicId }
  ];
  
  const topicDetails = [];
  
  for (const topic of topics) {
    console.log(`\n🔄 Retrieving information for ${topic.name} (${topic.id})...`);
    
    try {
      // Get topic info
      const topicInfo = await fetchTopicInfo(mirrorBaseUrl, topic.id);
      console.log(`✅ Retrieved topic info for ${topic.id}`);
      
      // Get messages count
      const messagesCount = await countMessages(mirrorBaseUrl, topic.id);
      console.log(`✅ Retrieved message count for ${topic.id}: ${messagesCount} messages`);
      
      // Get topic transactions
      const transactions = await fetchRecentTransactions(mirrorBaseUrl, topic.id);
      console.log(`✅ Retrieved ${transactions.length} recent transactions for ${topic.id}`);
      
      // Store details
      topicDetails.push({
        name: topic.name,
        id: topic.id,
        info: topicInfo,
        messagesCount,
        transactions
      });
      
      // Print topic details
      console.log(`\n📋 Topic Details for ${topic.name} (${topic.id}):`);
      console.log(JSON.stringify(topicInfo, null, 2));
      
      // Check recent operations against this topic
      console.log(`\n📋 Recent Transactions for ${topic.name} (${topic.id}):`);
      if (transactions.length > 0) {
        const summaries = transactions.map(tx => ({
          id: tx.transaction_id,
          timestamp: tx.consensus_timestamp,
          result: tx.result,
          type: tx.name || 'Unknown',
          entityId: tx.entity_id
        }));
        console.log(JSON.stringify(summaries, null, 2));
        
        // Check for invalid signature errors
        const invalidSigErrors = transactions.filter(tx => 
          tx.result === 'INVALID_SIGNATURE' || 
          tx.result_code === 7 || 
          (tx.charged_tx_fee === 0 && tx.result !== 'SUCCESS')
        );
        
        if (invalidSigErrors.length > 0) {
          console.log(`⚠️ Found ${invalidSigErrors.length} transactions with signature issues`);
          console.log(JSON.stringify(invalidSigErrors, null, 2));
        }
      } else {
        console.log('No recent transactions found');
      }
    } catch (error) {
      console.error(`❌ Error retrieving information for ${topic.id}:`, error.message);
    }
  }
  
  // Try direct SDK query if Mirror Node API had issues
  if (topicDetails.length < 2 || topicDetails.some(t => !t.info || Object.keys(t.info).length === 0)) {
    console.log('\n🔄 Mirror Node API had issues. Trying direct SDK query...');
    await checkTopicInfoDirectSDK();
  }
  
  // Compare topic settings
  if (topicDetails.length === 2) {
    console.log('\n🔄 Comparing topic configurations...');
    
    const inboundInfo = topicDetails[0].info;
    const outboundInfo = topicDetails[1].info;
    
    console.log('\n📊 Topic Comparison:');
    console.log('-------------------------------------------------');
    console.log('Property             | Inbound       | Outbound');
    console.log('-------------------------------------------------');
    
    // Key properties to compare
    const props = [
      'admin_key', 
      'submit_key', 
      'auto_renew_period', 
      'topic_id',
      'memo',
      'expiration_timestamp'
    ];
    
    for (const prop of props) {
      const inVal = formatValue(inboundInfo[prop]);
      const outVal = formatValue(outboundInfo[prop]);
      const propPadded = prop.padEnd(20);
      const inValPadded = inVal.padEnd(14);
      
      const different = inVal !== outVal;
      const line = `${propPadded} | ${inValPadded} | ${outVal}`;
      
      if (different) {
        console.log(`❗ ${line}`);
      } else {
        console.log(line);
      }
    }
    
    console.log('-------------------------------------------------');
    
    // Check for differences in success/failure patterns
    const inboundTxs = topicDetails[0].transactions;
    const outboundTxs = topicDetails[1].transactions;
    
    const inboundSuccess = inboundTxs.filter(tx => tx.result === 'SUCCESS').length;
    const inboundFailed = inboundTxs.filter(tx => tx.result !== 'SUCCESS').length;
    const outboundSuccess = outboundTxs.filter(tx => tx.result === 'SUCCESS').length;
    const outboundFailed = outboundTxs.filter(tx => tx.result !== 'SUCCESS').length;
    
    console.log('\n📊 Transaction Success Rates:');
    console.log('-------------------------------------------------');
    console.log('Topic               | Success       | Failed');
    console.log('-------------------------------------------------');
    console.log(`Inbound             | ${inboundSuccess.toString().padEnd(14)} | ${inboundFailed}`);
    console.log(`Outbound            | ${outboundSuccess.toString().padEnd(14)} | ${outboundFailed}`);
    console.log('-------------------------------------------------');
    
    // Look for key differences that might explain the issue
    console.log('\n🔍 Key Findings:');
    
    // Check for submit_key differences
    if (inboundInfo.submit_key !== outboundInfo.submit_key) {
      console.log('❗ The topics have different submit keys - this likely explains the signature issues');
      console.log(`   Inbound submit_key: ${inboundInfo.submit_key || 'None'}`);
      console.log(`   Outbound submit_key: ${outboundInfo.submit_key || 'None'}`);
    } else if (!inboundInfo.submit_key && !outboundInfo.submit_key) {
      console.log('✅ Both topics have open submission (no submit_key)');
    } else {
      console.log('✅ Both topics have identical submit_key');
    }
    
    // Check for admin key differences
    if (inboundInfo.admin_key !== outboundInfo.admin_key) {
      console.log('❗ The topics have different admin keys');
      console.log(`   Inbound admin_key: ${inboundInfo.admin_key || 'None'}`);
      console.log(`   Outbound admin_key: ${outboundInfo.admin_key || 'None'}`);
    } else if (!inboundInfo.admin_key && !outboundInfo.admin_key) {
      console.log('✅ Both topics have no admin_key (immutable)');
    } else {
      console.log('✅ Both topics have identical admin_key');
    }
    
    // Check for expiration
    if (inboundInfo.expiration_timestamp !== outboundInfo.expiration_timestamp) {
      console.log('ℹ️ The topics have different expiration timestamps');
      console.log(`   Inbound expiration: ${formatDate(inboundInfo.expiration_timestamp)}`);
      console.log(`   Outbound expiration: ${formatDate(outboundInfo.expiration_timestamp)}`);
    }
  }
  
  console.log('\n✅ Topic check completed');
}

// New function to check topic info using Hedera SDK directly
async function checkTopicInfoDirectSDK() {
  console.log('\n🔍 Checking topic information using Hedera SDK directly');
  
  // Create client and set operator
  let client;
  try {
    // Create client for the specified network
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
    
    // Set operator
    client.setOperator(operatorId, privateKey);
    console.log('✅ Hedera client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Hedera client:', error);
    return;
  }
  
  // Topics to check
  const topics = [
    { name: 'Inbound Topic', id: inboundTopicId },
    { name: 'Outbound Topic', id: outboundTopicId }
  ];
  
  const sdkTopicDetails = [];
  
  // Query each topic directly using the SDK
  for (const topic of topics) {
    console.log(`\n🔄 Getting direct SDK info for ${topic.name} (${topic.id})...`);
    
    try {
      // Create a TopicInfoQuery
      const query = new TopicInfoQuery()
        .setTopicId(topic.id);
      
      // Execute the query
      const info = await query.execute(client);
      
      // Format the response for easier comparison
      const formattedInfo = {
        topicId: info.topicId.toString(),
        adminKey: info.adminKey ? info.adminKey.toString() : null,
        submitKey: info.submitKey ? info.submitKey.toString() : null,
        autoRenewPeriod: info.autoRenewPeriod.seconds.toString(),
        expirationTime: info.expirationTime ? info.expirationTime.toString() : null,
        topicMemo: info.topicMemo
      };
      
      // Add to topic details
      sdkTopicDetails.push({
        name: topic.name,
        id: topic.id,
        info: formattedInfo
      });
      
      // Print the topic info
      console.log(`\n📋 SDK Topic Details for ${topic.name} (${topic.id}):`);
      console.log(JSON.stringify(formattedInfo, null, 2));
    } catch (error) {
      console.error(`❌ Error retrieving SDK info for ${topic.id}:`, error);
    }
  }
  
  // Compare topic settings if we have both
  if (sdkTopicDetails.length === 2) {
    console.log('\n🔄 Comparing SDK topic information...');
    
    const inboundInfo = sdkTopicDetails[0].info;
    const outboundInfo = sdkTopicDetails[1].info;
    
    console.log('\n📊 SDK Topic Comparison:');
    console.log('-------------------------------------------------');
    console.log('Property             | Inbound       | Outbound');
    console.log('-------------------------------------------------');
    
    // Properties to compare
    const props = [
      'adminKey', 
      'submitKey', 
      'autoRenewPeriod', 
      'topicId',
      'topicMemo',
      'expirationTime'
    ];
    
    for (const prop of props) {
      const inVal = formatValue(inboundInfo[prop]);
      const outVal = formatValue(outboundInfo[prop]);
      const propPadded = prop.padEnd(20);
      const inValPadded = inVal.padEnd(14);
      
      const different = inVal !== outVal;
      const line = `${propPadded} | ${inValPadded} | ${outVal}`;
      
      if (different) {
        console.log(`❗ ${line}`);
      } else {
        console.log(line);
      }
    }
    
    console.log('-------------------------------------------------');
    
    // Check for submit_key differences (critical for our issue)
    if (inboundInfo.submitKey !== outboundInfo.submitKey) {
      console.log('❗ [SDK] The topics have different submit keys - this likely explains the signature issues');
      console.log(`   Inbound submitKey: ${inboundInfo.submitKey || 'None'}`);
      console.log(`   Outbound submitKey: ${outboundInfo.submitKey || 'None'}`);
    } else if (!inboundInfo.submitKey && !outboundInfo.submitKey) {
      console.log('✅ [SDK] Both topics have open submission (no submitKey)');
    } else {
      console.log('✅ [SDK] Both topics have identical submitKey');
    }
    
    // Check for admin key differences
    if (inboundInfo.adminKey !== outboundInfo.adminKey) {
      console.log('❗ [SDK] The topics have different admin keys');
      console.log(`   Inbound adminKey: ${inboundInfo.adminKey || 'None'}`);
      console.log(`   Outbound adminKey: ${outboundInfo.adminKey || 'None'}`);
    } else if (!inboundInfo.adminKey && !outboundInfo.adminKey) {
      console.log('✅ [SDK] Both topics have no adminKey (immutable)');
    } else {
      console.log('✅ [SDK] Both topics have identical adminKey');
    }
  }
  
  console.log('\n✅ Direct SDK topic check completed');
}

// Helper function to fetch topic info from mirror node
async function fetchTopicInfo(baseUrl, topicId) {
  const url = `${baseUrl}/api/v1/topics/${topicId}`;
  console.log(`Fetching topic info from: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch topic info: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// Helper function to count messages for a topic
async function countMessages(baseUrl, topicId) {
  const url = `${baseUrl}/api/v1/topics/${topicId}/messages?limit=1`;
  console.log(`Fetching message count from: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.links?.next ? Number(data.links.next.split('=')?.[1]) : 0;
}

// Helper function to fetch recent transactions for a topic
async function fetchRecentTransactions(baseUrl, topicId) {
  // Use the /transactions endpoint to get recent transactions involving this topic
  const url = `${baseUrl}/api/v1/transactions?topic.id=${topicId}&limit=50&order=desc`;
  console.log(`Fetching recent transactions from: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.transactions || [];
}

// Helper function to format values for comparison
function formatValue(value) {
  if (value === undefined || value === null) {
    return 'None';
  }
  if (typeof value === 'object') {
    return 'Object';
  }
  return String(value);
}

// Helper function to format dates
function formatDate(timestamp) {
  if (!timestamp) return 'None';
  try {
    // Mirror node timestamps are in seconds.nanoseconds format
    const seconds = parseInt(timestamp.split('.')[0]);
    return new Date(seconds * 1000).toISOString();
  } catch (error) {
    return timestamp;
  }
}

// Run the check
checkTopicInfo()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 