#!/usr/bin/env node
/**
 * Start the ES Module compatible HCS10 agent with real Hedera network connection
 * This script starts a live agent that can respond to messages on the Hedera network
 */

import dotenv from 'dotenv';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicMessageQuery } from '@hashgraph/sdk';
import { HCS10AgentWithConnections } from './dist-esm/lib/hcs10-connection/hcs10-agent-with-connections.js';

// Load environment variables - make sure to use the path option
dotenv.config({ path: './.env.local' });

// Print all environment variables for debugging
console.log('Environment variables loaded:');
console.log('- NEXT_PUBLIC_OPERATOR_ID:', process.env.NEXT_PUBLIC_OPERATOR_ID || 'not set');
console.log('- OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
console.log('- NEXT_PUBLIC_HCS_INBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || 'not set');
console.log('- NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || 'not set');
console.log('- NEXT_PUBLIC_NETWORK:', process.env.NEXT_PUBLIC_NETWORK || 'not set');

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

// Extract environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

console.log('🚀 Starting live HCS-10 agent');
console.log(`Network: ${network}`);
console.log(`Operator ID: ${operatorId}`);
console.log(`Inbound topic: ${inboundTopicId}`);
console.log(`Outbound topic: ${outboundTopicId}`);

// Create a real Hedera client
class HederaHCS10Client {
  constructor() {
    this.client = null;
    this.operatorId = operatorId;
    this.network = network;
    this.init();
  }

  init() {
    console.log('🔄 Initializing Hedera client...');
    
    try {
      if (network === 'testnet') {
        this.client = Client.forTestnet();
      } else if (network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        throw new Error(`Unknown network: ${network}`);
      }
      
      // Set operator
      this.client.setOperator(operatorId, operatorKey);
      
      console.log('✅ Hedera client initialized');
    } catch (error) {
      console.error('❌ Error initializing Hedera client:', error);
      throw error;
    }
  }

  // HCS10Client interface methods
  async createTopic() {
    throw new Error('Not implemented: Using existing topics');
  }

  async sendMessage(topicId, message) {
    try {
      console.log(`Attempting to send message to topic ${topicId}...`);
      
      // Create the transaction with more explicit steps
      const messageSubmit = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(message)
        .setMaxTransactionFee(5); // Set a reasonable max fee (in Hbar)
      
      // Freeze the transaction
      const txFrozen = await messageSubmit.freezeWith(this.client);
      
      // Sign explicitly with the client's key
      const signedTx = await txFrozen.sign(PrivateKey.fromString(operatorKey));
      
      // Execute the transaction
      const response = await signedTx.execute(this.client);
      
      // Don't wait for receipt to avoid potential errors
      console.log(`✅ Message sent to topic ${topicId}`);
      console.log(`Transaction ID: ${response.transactionId.toString()}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending message to topic ${topicId}:`, error);
      // Log more details about the error
      if (error.status) {
        console.error(`Error status code: ${error.status._code}`);
      }
      return { success: false, error };
    }
  }

  async getMessageStream(topicId) {
    try {
      // For the real implementation, we'll query recent messages
      const messages = await this.getMessages(topicId);
      return { messages };
    } catch (error) {
      console.error(`❌ Error getting message stream for topic ${topicId}:`, error);
      return { messages: [] };
    }
  }

  // Required method for ConnectionsManager
  async retrieveCommunicationTopics() {
    return {
      inbound: inboundTopicId,
      outbound: outboundTopicId
    };
  }

  // Required method for ConnectionsManager
  async getMessages(topicId) {
    try {
      console.log(`Getting messages from topic ${topicId}...`);
      
      // For a real implementation, we would query the mirror node
      // But for this test, let's actively poll for messages using TopicMessageQuery
      if (!this.subscriptions) {
        this.subscriptions = {};
        this.latestMessages = {};
        
        // Set up a subscription to the inbound topic
        this.subscribeToTopic(inboundTopicId);
      }
      
      // Return any messages we've collected
      return this.latestMessages[topicId] || [];
    } catch (error) {
      console.error(`❌ Error getting messages for topic ${topicId}:`, error);
      return [];
    }
  }
  
  // Subscribe to a topic and collect messages
  subscribeToTopic(topicId) {
    console.log(`Setting up subscription to topic ${topicId}...`);
    
    if (this.subscriptions[topicId]) {
      console.log(`Already subscribed to topic ${topicId}`);
      return;
    }
    
    try {
      // Initialize message collection for this topic
      if (!this.latestMessages[topicId]) {
        this.latestMessages[topicId] = [];
      }
      
      // Set up subscription
      this.subscriptions[topicId] = new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(this.client, null, (message) => {
          const contents = Buffer.from(message.contents).toString();
          const consensusTimestamp = message.consensusTimestamp.toDate();
          
          console.log(`🔔 Received message on topic ${topicId} at ${consensusTimestamp.toISOString()}`);
          console.log(`Content: ${contents}`);
          
          // Store the message for getMessages to return
          this.latestMessages[topicId].push({
            contents,
            sequence_number: Date.now(), // Use timestamp as sequence
            consensus_timestamp: consensusTimestamp
          });
          
          // Only keep the last 10 messages
          if (this.latestMessages[topicId].length > 10) {
            this.latestMessages[topicId].shift();
          }
          
          // Process the message directly
          this.processMessageDirectly(contents, topicId);
        });
      
      console.log(`✅ Successfully subscribed to topic ${topicId}`);
    } catch (error) {
      console.error(`❌ Error subscribing to topic ${topicId}:`, error);
    }
  }
  
  // Process a message directly (for immediate feedback during testing)
  async processMessageDirectly(content, topicId) {
    console.log(`🔄 Directly processing message from topic ${topicId}`);
    
    try {
      // Parse the message
      const message = JSON.parse(content);
      
      // Check if it's a valid HCS-10 message
      if (message.p !== 'hcs-10') {
        console.log('Not an HCS-10 message, ignoring');
        return;
      }
      
      console.log(`Processing message with operation: ${message.op}`);
      
      // Handle connection request
      if (message.op === 'connection_request') {
        console.log('Responding to connection request...');
        
        // Create connection_created response
        const response = {
          p: 'hcs-10',
          op: 'connection_created',
          connection_topic_id: outboundTopicId,
          connected_account_id: operatorId,
          operator_id: `${outboundTopicId}@${operatorId}`,
          connection_id: Date.now(),
          m: 'Connection established from direct handler'
        };
        
        // Send response to outbound topic
        await this.sendMessage(outboundTopicId, JSON.stringify(response));
        console.log('✅ Connection response sent');
      }
      
      // Handle regular message
      if (message.op === 'message') {
        console.log('Responding to regular message...');
        
        // Create response message
        const response = {
          p: 'hcs-10',
          op: 'message',
          data: JSON.stringify({
            type: 'ResponseMessage',
            content: 'I received your message!',
            timestamp: new Date().toISOString(),
            original: message.data
          })
        };
        
        // Send response to outbound topic
        await this.sendMessage(outboundTopicId, JSON.stringify(response));
        console.log('✅ Message response sent');
      }
    } catch (error) {
      console.error('❌ Error processing message directly:', error);
    }
  }

  // Required method for ConnectionsManager
  getMirrorClient() {
    // Return a simple mock of the mirror client interface
    return {
      getTopicMessages: async () => ({ messages: [] })
    };
  }
}

// Start the agent
async function startAgent() {
  try {
    // Create the client
    const client = new HederaHCS10Client();
    
    // Create the agent
    const agent = new HCS10AgentWithConnections(
      client,
      inboundTopicId,
      outboundTopicId,
      operatorId
    );
    
    // Set up event listeners
    agent.on('connectionsManagerReady', () => {
      console.log('✅ ConnectionsManager is ready!');
    });
    
    agent.on('connectionsManagerError', (error) => {
      console.error('❌ ConnectionsManager error:', error);
    });
    
    agent.on('message', (content) => {
      console.log('📩 Message received:', content);
      
      // Try to parse the message
      try {
        const message = JSON.parse(content);
        console.log('Parsed message:', message);
      } catch (error) {
        console.log('Could not parse message as JSON');
      }
    });
    
    // Start polling for messages
    console.log('🚀 Starting agent polling...');
    agent.start(10000); // Poll every 10 seconds
    
    // Wait for ConnectionsManager initialization
    console.log('⏳ Waiting for ConnectionsManager to initialize...');
    const ready = await agent.waitUntilReady(30000);
    
    if (ready) {
      console.log('✅ Agent successfully initialized and ready for messages');
    } else {
      console.log('⚠️ Agent initialization timed out or failed');
      console.log('Continuing with base functionality...');
    }
    
    console.log('✅ Agent is now running and listening for messages');
    console.log('Press Ctrl+C to stop the agent...');
    
    // Keep the process running
    process.stdin.resume();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('🛑 Shutting down agent...');
      agent.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error starting agent:', error);
    process.exit(1);
  }
}

// Start the agent
startAgent().catch(console.error); 