#!/usr/bin/env node
/**
 * Direct ConnectionsManager Test Script
 * Tests the ConnectionsManager integration directly using CommonJS
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const operatorKey = process.env.OPERATOR_KEY || '';
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '';
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID || operatorId;

console.log('📊 Starting ConnectionsManager direct test');
console.log('Environment variables:');
console.log(`- Operator ID: ${operatorId ? '✅ Set' : '❌ Missing'}`);
console.log(`- Operator Key: ${operatorKey ? '✅ Set' : '❌ Missing'}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);
console.log(`- Agent ID: ${agentId}`);

async function testConnectionsManager() {
  try {
    console.log('\n🔍 Testing ConnectionsManager directly...');
    
    // Method 1: Try dynamic import with createRequire
    try {
      console.log('📦 Testing ConnectionsManager import with createRequire...');
      const { createRequire } = require('module');
      const require = createRequire(__filename);
      
      try {
        const standardsSDK = require('@hashgraphonline/standards-sdk');
        console.log('✅ Standards SDK loaded via createRequire');
        
        if (standardsSDK && standardsSDK.ConnectionsManager) {
          console.log('✅ ConnectionsManager found');
          console.log(`   Version: ${standardsSDK.version || 'unknown'}`);
        } else {
          console.log('❌ ConnectionsManager not found in the loaded module');
        }
      } catch (error) {
        console.error('❌ Error loading standards-sdk via createRequire:', error.message);
      }
    } catch (error) {
      console.error('❌ Error using createRequire:', error.message);
    }
    
    // Method 2: Try require directly
    try {
      console.log('\n📦 Testing ConnectionsManager import with direct require...');
      
      try {
        const standardsSDK = require('@hashgraphonline/standards-sdk');
        console.log('✅ Standards SDK loaded via direct require');
        
        if (standardsSDK && standardsSDK.ConnectionsManager) {
          console.log('✅ ConnectionsManager found');
          console.log(`   Version: ${standardsSDK.version || 'unknown'}`);
        } else {
          console.log('❌ ConnectionsManager not found in the loaded module');
        }
      } catch (error) {
        console.error('❌ Error loading standards-sdk via direct require:', error.message);
      }
    } catch (error) {
      console.error('❌ Error using direct require:', error.message);
    }
    
    // Method 3: Load the wrapper
    try {
      console.log('\n📦 Testing connection-manager-wrapper...');
      
      const wrapper = require('../src/scripts/connection-manager-wrapper.cjs');
      console.log('✅ Wrapper module loaded');
      
      if (wrapper && typeof wrapper.getConnectionsManager === 'function') {
        console.log('✅ getConnectionsManager function found');
        
        try {
          // Create a mock client with the required methods
          const mockClient = {
            retrieveCommunicationTopics: async (accountId) => ({
              inboundTopic: inboundTopicId,
              outboundTopic: outboundTopicId
            }),
            getMessages: async (topicId) => [],
            network: 'testnet',
            operatorId: operatorId,
            operatorPrivateKey: operatorKey
          };
          
          const ConnectionsManager = await wrapper.getConnectionsManager();
          console.log('✅ ConnectionsManager class loaded via wrapper');
          
          // Try to create an instance with our mock client
          const cm = new ConnectionsManager({
            baseClient: mockClient,
            logLevel: 'debug'
          });
          
          console.log('✅ ConnectionsManager instance created successfully');
          
          // Test setAgentInfo method
          try {
            await cm.setAgentInfo({
              accountId: agentId,
              inboundTopicId: inboundTopicId,
              outboundTopicId: outboundTopicId
            });
            console.log('✅ setAgentInfo successful');
          } catch (error) {
            console.error('❌ Error calling setAgentInfo:', error.message);
          }
          
          // Test getPendingRequests method
          try {
            const pendingRequests = cm.getPendingRequests();
            console.log(`✅ getPendingRequests successful (${pendingRequests.length} pending requests)`);
          } catch (error) {
            console.error('❌ Error calling getPendingRequests:', error.message);
          }
          
          // Test other methods if available
          if (typeof cm.getConnectionStore === 'function') {
            try {
              const connectionStore = cm.getConnectionStore();
              console.log(`✅ getConnectionStore successful (${connectionStore.length} connections)`);
            } catch (error) {
              console.error('❌ Error calling getConnectionStore:', error.message);
            }
          }
          
          if (typeof cm.listConnections === 'function') {
            try {
              const connections = cm.listConnections();
              console.log(`✅ listConnections successful (${connections.length} connections)`);
            } catch (error) {
              console.error('❌ Error calling listConnections:', error.message);
            }
          }
        } catch (error) {
          console.error('❌ Error getting ConnectionsManager via wrapper:', error.message);
        }
      } else {
        console.log('❌ getConnectionsManager function not found in wrapper');
      }
    } catch (error) {
      console.error('❌ Error loading wrapper:', error.message);
    }
    
    console.log('\n📊 Test completed.');
  } catch (error) {
    console.error('❌ Unhandled error:', error);
  }
}

// Run the test
testConnectionsManager().catch(error => {
  console.error('❌ Fatal error:', error);
}); 