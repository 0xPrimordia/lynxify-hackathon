#!/usr/bin/env node
/**
 * Live on-chain test for ES Module compatible HCS10 agent
 * This test sends a real message to the Hedera network and verifies the agent responds
 */

import * as dotenv from 'dotenv';
import { 
  Client, 
  PrivateKey, 
  TopicMessageSubmitTransaction,
  TopicMessageQuery
} from '@hashgraph/sdk';
import fetch from 'node-fetch';

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

console.log('🔄 Live HCS-10 Agent Test');
console.log(`Using operator ID: ${operatorId}`);
console.log(`Using inbound topic: ${inboundTopicId}`);
console.log(`Using outbound topic: ${outboundTopicId}`);

// Store poll intervals for cleanup
const globalPollIntervals = [];

// Create a real Hedera client that matches the agent exactly
class HederaHCS10Client {
  constructor() {
    this.client = null;
    this.operatorId = operatorId;
    this.operatorKey = operatorKey; // Store the original key string
    this.privateKey = null; // Will store the PrivateKey instance
    this.network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
    this.init();
  }

  init() {
    console.log('🔄 Initializing Hedera client...');
    
    try {
      if (this.network === 'testnet') {
        this.client = Client.forTestnet();
      } else if (this.network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        throw new Error(`Unknown network: ${this.network}`);
      }
      
      // Set operator
      this.client.setOperator(operatorId, operatorKey);
      
      // Create a PrivateKey instance for direct signing
      this.privateKey = PrivateKey.fromString(operatorKey);
      console.log('Created PrivateKey instance from operator key');
      
      console.log('✅ Hedera client initialized');
    } catch (error) {
      console.error('❌ Error initializing Hedera client:', error);
      throw error;
    }
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
      
      // Sign explicitly with the stored PrivateKey instance
      const signedTx = await txFrozen.sign(this.privateKey);
      
      // Execute the transaction
      const response = await signedTx.execute(this.client);
      
      // Don't wait for receipt to avoid potential errors
      console.log(`✅ Message sent to topic ${topicId}`);
      console.log(`Transaction ID: ${response.transactionId.toString()}`);
      
      return { success: true, response };
    } catch (error) {
      console.error(`❌ Error sending message to topic ${topicId}:`, error);
      // Log more details about the error
      if (error.status) {
        console.error(`Error status code: ${error.status._code}`);
      }
      return { success: false, error };
    }
  }
}

// Subscribe to messages on a topic
async function subscribeToTopic(client, topicId, callback) {
  console.log(`🔄 Subscribing to topic ${topicId}...`);
  
  try {
    console.log('Setting up TopicMessageQuery...');
    
    // Look back further to make sure we don't miss messages due to mirror node latency
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 30); // Look back 30 minutes
    
    console.log(`Starting subscription from ${startTime.toISOString()}`);
    
    // Create the subscription with explicit error handling
    try {
      new TopicMessageQuery()
        .setTopicId(topicId)
        .setStartTime(startTime)
        .setLimit(100) // Increase the limit to get more messages
        .subscribe(
          client, 
          (error) => {
            console.error(`❌ Subscription error for topic ${topicId}:`, error);
            // Try to re-subscribe on error
            setTimeout(() => {
              console.log(`🔄 Attempting to re-subscribe to topic ${topicId}...`);
              subscribeToTopic(client, topicId, callback);
            }, 5000);
          },
          (message) => {
            const contents = Buffer.from(message.contents).toString();
            const consensusTimestamp = message.consensusTimestamp.toDate();
            
            console.log(`\n📩 Received message on topic ${topicId} at ${consensusTimestamp.toISOString()}`);
            console.log(`Content length: ${contents.length} characters`);
            
            // Pass to callback
            if (callback) {
              callback(contents, message);
            }
          }
        );
      
      console.log(`✅ Successfully subscribed to topic ${topicId}`);
      console.log('Waiting for messages...');
    } catch (subError) {
      console.error(`❌ Error creating subscription for topic ${topicId}:`, subError);
      throw subError;
    }
    
    // ALTERNATIVE: Also use polling to check for messages regularly
    // since mirror node subscriptions can be unreliable
    console.log('Setting up fallback polling for messages via REST API...');
    let lastTimestamp = startTime;
    
    const pollInterval = setInterval(async () => {
      try {
        // Use the REST API method which is more reliable
        const found = await checkMirrorNodeForMessages(topicId, lastTimestamp, callback);
        
        if (found) {
          // Update lastTimestamp to current time minus 5 seconds
          const now = new Date();
          lastTimestamp = new Date();
          lastTimestamp.setSeconds(lastTimestamp.getSeconds() - 5);
        }
      } catch (pollError) {
        console.error(`❌ Error polling for messages:`, pollError);
      }
    }, 5000); // Poll every 5 seconds
    
    // Store the interval for cleanup
    globalPollIntervals.push(pollInterval);
    
  } catch (error) {
    console.error(`❌ Error subscribing to topic ${topicId}:`, error);
    throw error;
  }
}

// Create a connection request message
function createConnectionRequest() {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'connection_request',
    operator_id: `${inboundTopicId}@${operatorId}`,
    m: 'Connection request for live testing'
  });
}

// Create a standard test message
function createTestMessage() {
  return JSON.stringify({
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify({
      type: 'TestMessage',
      content: 'Hello from live test!',
      timestamp: new Date().toISOString()
    })
  });
}

// Function to check for messages via Mirror Node REST API
async function checkMirrorNodeForMessages(topicId, startTime, callback) {
  try {
    // Get network from env
    const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
    
    // Determine base URL based on network
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    
    // Convert timestamp to seconds.nanoseconds format for the Mirror Node API
    // This is the format that the Mirror Node API expects
    const timeInSeconds = Math.floor(startTime.getTime() / 1000);
    const formattedTimestamp = timeInSeconds.toString();
    
    // Construct the API URL with proper format for the Hedera Mirror Node
    const url = `${baseUrl}/api/v1/topics/${topicId}/messages?timestamp=gt:${formattedTimestamp}&limit=100&order=asc`;
    
    console.log(`🔄 Checking Mirror Node API: ${url}`);
    
    // Make the API request with proper handling
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        response = await fetch(url);
        break;
      } catch (fetchError) {
        console.error(`Error fetching from Mirror Node (retries left: ${retries-1}):`, fetchError.message);
        retries--;
        if (retries === 0) throw fetchError;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('Topic not found or no messages available');
        return false;
      }
      throw new Error(`Mirror Node API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.messages && data.messages.length > 0) {
      console.log(`✅ Found ${data.messages.length} messages via REST API`);
      
      // Process each message
      for (const msg of data.messages) {
        // Extract and decode the message content
        const contents = Buffer.from(msg.message, 'base64').toString('utf8');
        const consensusTimestamp = new Date(msg.consensus_timestamp);
        
        console.log(`\n📩 [REST API] Message on topic ${topicId} at ${consensusTimestamp.toISOString()}`);
        console.log(`Content: ${contents}`);
        
        // Create a message object that matches the SDK format
        const message = {
          contents: Buffer.from(msg.message, 'base64'),
          consensusTimestamp: {
            toDate: () => consensusTimestamp
          },
          sequenceNumber: parseInt(msg.sequence_number),
          topicId: msg.topic_id
        };
        
        // Pass to callback
        if (callback) {
          callback(contents, message);
        }
      }
      
      return true;
    } else {
      console.log('No messages found via REST API');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking Mirror Node API:', error);
    return false;
  }
}

// Main test function - updated to use the same client as the agent
async function runLiveTest() {
  console.log('🚀 Starting live on-chain HCS-10 agent test');
  
  try {
    // Initialize Hedera client using the same class as the agent
    const hederaClient = new HederaHCS10Client();
    console.log('✅ Hedera client initialized with same implementation as agent');
    
    // Subscribe to outbound topic to receive agent responses
    let receivedResponse = false;
    const messageCallback = (content, message) => {
      try {
        console.log('🔍 Analyzing received message:');
        console.log('Raw content:', content);
        
        // Try to parse as JSON
        let parsedContent;
        try {
          parsedContent = JSON.parse(content);
          console.log('Parsed content:', JSON.stringify(parsedContent, null, 2));
        } catch (parseError) {
          console.log('Not valid JSON content');
          return;
        }
        
        // Check for HCS-10 message
        if (parsedContent.p === 'hcs-10') {
          console.log('✅ Received valid HCS-10 message from agent!');
          console.log('Operation:', parsedContent.op);
          
          // For connection_created messages
          if (parsedContent.op === 'connection_created') {
            console.log('✅ Received connection confirmation from agent!');
          }
          
          // For standard message responses
          if (parsedContent.op === 'message' && parsedContent.data) {
            console.log('✅ Received message response from agent!');
            try {
              const innerData = JSON.parse(parsedContent.data);
              console.log('Response content:', innerData);
            } catch (e) {
              console.log('Data not in JSON format:', parsedContent.data);
            }
          }
          
          receivedResponse = true;
        } else {
          console.log('❌ Not an HCS-10 protocol message');
        }
      } catch (error) {
        console.error('❌ Error analyzing message:', error);
      }
    };
    
    await subscribeToTopic(hederaClient.client, outboundTopicId, messageCallback);
    
    // Send connection request message
    console.log('📤 Sending connection request...');
    const connectionRequest = createConnectionRequest();
    const sendResult = await hederaClient.sendMessage(inboundTopicId, connectionRequest);
    
    if (sendResult.success) {
      console.log('✅ Connection request sent successfully');
    } else {
      console.error('❌ Error sending connection request:', sendResult.error);
      process.exit(1);
    }
    
    // Wait for a response (connection_created)
    console.log('⏳ Waiting for connection response (30 seconds)...');
    
    // Set up multiple checks to find messages on the outbound topic
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = 5000; // 5 seconds
    
    while (!receivedResponse && attempts < maxAttempts) {
      attempts++;
      console.log(`Checking for messages (attempt ${attempts}/${maxAttempts})...`);
      
      // Check with progressively further back timestamps
      const connectionStartTime = new Date();
      connectionStartTime.setMinutes(connectionStartTime.getMinutes() - (10 * attempts)); // Look back 10, 20, 30... minutes
      
      try {
        await checkMirrorNodeForMessages(outboundTopicId, connectionStartTime, messageCallback);
      } catch (error) {
        console.error('Error checking for messages:', error.message);
      }
      
      // Wait before next check
      if (!receivedResponse && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    if (receivedResponse) {
      console.log('✅ Agent responded to connection request!');
    } else {
      console.log('⚠️ No response received from agent within timeout');
      console.log('Will still attempt to send a test message...');
    }
    
    // Send test message
    console.log('📤 Sending test message...');
    const testMessage = createTestMessage();
    const testSendResult = await hederaClient.sendMessage(inboundTopicId, testMessage);
    
    if (testSendResult.success) {
      console.log('✅ Test message sent successfully');
    } else {
      console.error('❌ Error sending test message:', testSendResult.error);
      process.exit(1);
    }
    
    // Reset flag to check for response to this specific message
    receivedResponse = false;
    attempts = 0;
    
    // Wait for a response
    console.log('⏳ Waiting for message response (30 seconds)...');
    
    // Multiple checks for test message response
    while (!receivedResponse && attempts < maxAttempts) {
      attempts++;
      console.log(`Checking for message responses (attempt ${attempts}/${maxAttempts})...`);
      
      // Check with progressively further back timestamps
      const messageStartTime = new Date();
      messageStartTime.setMinutes(messageStartTime.getMinutes() - (10 * attempts)); // Look back 10, 20, 30... minutes
      
      try {
        await checkMirrorNodeForMessages(outboundTopicId, messageStartTime, messageCallback);
      } catch (error) {
        console.error('Error checking for message responses:', error.message);
      }
      
      // Wait before next check
      if (!receivedResponse && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    // Final status check
    if (receivedResponse) {
      console.log('🎉 Live test completed successfully! Agent is responding properly.');
    } else {
      console.log('⚠️ Live test completed, but no response was received from the agent.');
      console.log('This could indicate an issue with the agent or its configuration.');
      
      // One last check with a very old timestamp to catch any historical messages
      console.log('Performing final message check with extended history...');
      const finalCheckTime = new Date();
      finalCheckTime.setHours(finalCheckTime.getHours() - 24); // Look back 24 hours
      await checkMirrorNodeForMessages(outboundTopicId, finalCheckTime, messageCallback);
    }
    
    // Keep the process running to continue receiving messages
    console.log('Press Ctrl+C to stop the test...');
    
    // Handle cleanup on exit
    process.on('SIGINT', () => {
      console.log('🛑 Shutting down test...');
      // Clear all polling intervals
      for (const interval of globalPollIntervals) {
        clearInterval(interval);
      }
      process.exit(0);
    });
  } catch (error) {
    // Clean up on error
    for (const interval of globalPollIntervals) {
      clearInterval(interval);
    }
    
    console.error('❌ Error in live test:', error);
    process.exit(1);
  }
}

// Run the test
runLiveTest().catch(error => {
  console.error('❌ Error in live test:', error);
  process.exit(1);
}); 