#!/usr/bin/env ts-node
/**
 * Moonscape Integration Test
 * This script sends a real message to Moonscape outbound channel
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Import SDK using CommonJS syntax
const { 
  TopicMessageSubmitTransaction,
  Client, 
  PrivateKey,
  AccountId,
  TopicId
} = require('@hashgraph/sdk');

// Simple connection test
async function main() {
  try {
    console.log('🚀 Starting Moonscape HCS-10 test...');
    
    // Log important environment variables
    console.log('ENV VARIABLES:');
    console.log('- OPERATOR_ID:', process.env.NEXT_PUBLIC_OPERATOR_ID);
    console.log('- REGISTRY TOPIC:', process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC);
    console.log('- INBOUND TOPIC:', process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC);
    console.log('- OUTBOUND TOPIC:', process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC);
    console.log('- PROFILE TOPIC:', process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC);
    
    // Initialize Hedera client
    if (!process.env.OPERATOR_KEY || !process.env.NEXT_PUBLIC_OPERATOR_ID) {
      throw new Error('Missing required environment variables');
    }
    
    console.log('Creating Hedera client...');
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID);
    const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Test 1: Registry registration
    if (process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC) {
      console.log('STEP 1: Registering with registry...');
      const registryTopicId = TopicId.fromString(process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC);
      
      console.info(`Registering agent ${operatorId.toString()} with registry ${registryTopicId.toString()}`);
      
      const registrationMessage = {
        p: "hcs-10",
        op: "register",
        account_id: operatorId.toString(),
        m: "Registering Lynxify Agent with Moonscape"
      };
      
      const messageString = JSON.stringify(registrationMessage);
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(registryTopicId)
        .setMessage(messageString);
        
      console.log('Sending registry registration...');
      const txResponse = await transaction.execute(client);
      console.log('Waiting for receipt...');
      const receipt = await txResponse.getReceipt(client);
      console.log('✅ Registration message sent successfully with status:', receipt.status.toString());
    } else {
      console.log('❌ Cannot register - Registry topic not configured');
    }
    
    // Test 2: Profile Update
    if (process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC) {
      console.log('STEP 2: Updating agent profile...');
      const profileTopicId = TopicId.fromString(process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC);
      
      console.info(`Updating agent profile on ${profileTopicId.toString()}`);
      
      // This should follow the HCS-11 profile standard that integrates with HCS-10
      const profileMessage = {
        version: "1.0",
        type: "AgentMessage",
        timestamp: Date.now(),
        sender: "Lynxify Agent",
        details: {
          message: "Agent profile update",
          testTime: new Date().toISOString(),
          accountId: operatorId.toString(),
          inboundTopicId: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
          outboundTopicId: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC,
          display_name: "Lynxify Agent",
          alias: "lynxify_agent",
          bio: "AI-powered rebalancing agent for the Lynxify Tokenized Index",
          capabilities: ['rebalancing', 'market_analysis', 'token_management', 'portfolio_optimization'],
          agentDescription: 'AI-powered rebalancing agent for the Lynxify Tokenized Index'
        }
      };
      
      const messageString = JSON.stringify(profileMessage);
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(profileTopicId)
        .setMessage(messageString);
      
      console.log('Sending profile update...');
      const txResponse = await transaction.execute(client);
      console.log('Waiting for receipt...');
      const receipt = await txResponse.getReceipt(client);
      console.log('✅ Profile message sent successfully with status:', receipt.status.toString());
    } else {
      console.log('❌ Cannot update profile - Profile topic not configured');
    }
    
    // Test 3: Send Agent Status Message
    if (process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC) {
      console.log('STEP 3: Sending agent status...');
      const outboundTopicId = TopicId.fromString(process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC);
      
      console.info(`Sending agent status to outbound topic ${outboundTopicId.toString()}`);
      
      const statusMessage = {
        id: `status-${Date.now()}`,
        type: "AgentMessage",
        timestamp: Date.now(),
        sender: "Lynxify Agent",
        details: {
          message: "Agent status update",
          testTime: new Date().toISOString(),
          agentId: operatorId.toString()
        }
      };
      
      const messageString = JSON.stringify(statusMessage);
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(outboundTopicId)
        .setMessage(messageString);
      
      console.log('Sending status message...');
      const txResponse = await transaction.execute(client);
      console.log('Waiting for receipt...');
      const receipt = await txResponse.getReceipt(client);
      console.log('✅ Status message sent successfully with status:', receipt.status.toString());
    } else {
      console.log('❌ Cannot send status - Outbound topic not configured');
    }
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

// Run the test
main(); 