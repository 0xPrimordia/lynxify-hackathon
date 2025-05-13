#!/usr/bin/env node

import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Test script to validate ConnectionsManager and message handling
 */
async function main() {
  try {
    console.log('🧪 Starting HCS10 Agent Test...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
    const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
    
    // Verify environment variables
    if (!operatorId || !operatorKey || !agentId || !inboundTopicId || !outboundTopicId) {
      console.error('❌ Missing required environment variables');
      console.log('Required: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY, NEXT_PUBLIC_HCS_AGENT_ID, NEXT_PUBLIC_HCS_INBOUND_TOPIC, NEXT_PUBLIC_HCS_OUTBOUND_TOPIC');
      process.exit(1);
    }
    
    console.log('✅ Environment variables loaded successfully');
    console.log(`   Agent ID: ${agentId}`);
    console.log(`   Inbound Topic: ${inboundTopicId}`);
    console.log(`   Outbound Topic: ${outboundTopicId}`);
    
    // Create HCS10 client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Initialize ConnectionsManager
    console.log('🔄 Initializing ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({ baseClient: client });
    console.log('✅ ConnectionsManager initialized');
    
    // Load connections from ConnectionsManager
    console.log('🔄 Fetching connections from Hedera...');
    const connections = await connectionsManager.fetchConnectionData(agentId, true); // force fresh fetch
    
    // Display connections info
    const activeConnections = connectionsManager.getActiveConnections();
    const pendingRequests = connectionsManager.getPendingRequests();
    const needsConfirmationConnections = connectionsManager.getConnectionsNeedingConfirmation();
    
    console.log(`🔍 Total connections: ${connections.length}`);
    console.log(`🔍 Active connections: ${activeConnections.length}`);
    console.log(`🔍 Pending requests: ${pendingRequests.length}`);
    console.log(`🔍 Connections needing confirmation: ${needsConfirmationConnections.length}`);
    
    // Check for duplicate connections
    const topicMap = new Map();
    const accountMap = new Map();
    let duplicateTopics = 0;
    let duplicateAccounts = 0;
    
    for (const conn of connections) {
      // Check for duplicate topic IDs
      if (conn.connectionTopicId) {
        if (topicMap.has(conn.connectionTopicId)) {
          duplicateTopics++;
          console.log(`⚠️ Duplicate connection topic found: ${conn.connectionTopicId}`);
        } else {
          topicMap.set(conn.connectionTopicId, true);
        }
      }
      
      // Check for duplicate account IDs
      if (conn.targetAccountId) {
        if (accountMap.has(conn.targetAccountId)) {
          duplicateAccounts++;
          console.log(`⚠️ Duplicate account connection found: ${conn.targetAccountId}`);
        } else {
          accountMap.set(conn.targetAccountId, true);
        }
      }
    }
    
    console.log(`📊 Connection analysis:`);
    console.log(`   Unique topics: ${topicMap.size}`);
    console.log(`   Duplicate topics: ${duplicateTopics}`);
    console.log(`   Unique accounts: ${accountMap.size}`);
    console.log(`   Duplicate account connections: ${duplicateAccounts}`);
    
    // Show sample connections data
    if (connections.length > 0) {
      console.log('🔍 Sample connection data:');
      console.log(JSON.stringify(connections[0], null, 2));
    }
    
    // Test message retrieval
    console.log(`🔄 Testing message retrieval from inbound topic ${inboundTopicId}...`);
    const messages = await client.getMessageStream(inboundTopicId);
    
    if (messages && messages.length > 0) {
      console.log(`📬 Found ${messages.length} messages on inbound topic`);
      console.log('🔍 Sample message:');
      console.log(JSON.stringify(messages[0], null, 2));
      
      // Test message processing
      console.log('🔄 Testing message processing with ConnectionsManager...');
      connectionsManager.processInboundMessages(messages);
      
      // Check if any connections were affected
      const connectionsAfter = await connectionsManager.fetchConnectionData(agentId);
      console.log(`🔍 Connections after processing: ${connectionsAfter.length}`);
    } else {
      console.log('ℹ️ No messages found on inbound topic');
    }
    
    // Send test message to outbound topic
    console.log(`🔄 Sending test message to outbound topic ${outboundTopicId}...`);
    const testMessage = {
      p: 'hcs-10',
      op: 'debug_info',
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      connections: {
        active: activeConnections.length,
        pending: pendingRequests.length,
        needs_confirmation: needsConfirmationConnections.length,
        total: connections.length
      },
      test: true
    };
    
    const sendResult = await client.sendMessage(outboundTopicId, JSON.stringify(testMessage));
    console.log('✅ Test message sent successfully:', sendResult);
    
    console.log('🏁 Test completed successfully');
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

// Run the test
main().catch(console.error); 