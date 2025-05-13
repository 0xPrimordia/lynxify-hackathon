#!/usr/bin/env node

import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connection tracking
let connectionTopicId = null;
let agentId = null;
let client = null;
let lastMessageTimestamp = null;
let pollingInterval = null;

/**
 * Initialize the test client
 */
async function initialize() {
  try {
    console.log('🔍 Reading test credentials...');
    
    // Use the available environment variables that work with the agent
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    
    if (!operatorId || !operatorKey || !agentId) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY, NEXT_PUBLIC_HCS_AGENT_ID');
    }
    
    console.log(`✅ Will test connection to agent: ${agentId}`);
    console.log(`✅ Using identity: ${operatorId}`);
    
    // Create HCS10 client
    console.log('🔄 Creating HCS10 client...');
    client = new HCS10Client({
      network: 'testnet',
      operatorId: operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    return true;
  } catch (error) {
    console.error('❌ Error initializing test client:', error);
    return false;
  }
}

/**
 * Establish a connection to the agent
 */
async function connectToAgent() {
  try {
    console.log(`🔄 Initiating connection to agent ${agentId}...`);
    
    // Create a ConnectionsManager to handle connections
    console.log('🔄 Creating ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      baseClient: client
    });
    
    console.log('✅ ConnectionsManager created');
    
    try {
      // Method 1: Try creating a connection with ConnectionsManager
      console.log('Attempt 1: Using ConnectionsManager to create connection request');
      // We need the inbound topic of the agent
      // Let's try to get it directly from the environment variable
      const targetInboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
      
      if (!targetInboundTopicId) {
        throw new Error('Missing NEXT_PUBLIC_HCS_INBOUND_TOPIC environment variable');
      }
      
      // Create a connection request to the agent
      const result = await connectionsManager.createConnectionRequest(
        agentId,
        targetInboundTopicId
      );
      
      connectionTopicId = result.connectionTopicId;
      console.log(`✅ Connection established! Topic ID: ${connectionTopicId}`);
    } catch (error) {
      console.error('❌ Error with method 1:', error);
      
      // Method 2: Try to get existing connections
      console.log('Attempt 2: Checking for existing connections...');
      await connectionsManager.fetchConnectionData(client.operatorId);
      const connections = connectionsManager.getAllConnections();
      
      console.log(`Found ${connections.length} existing connections`);
      
      // Find an established connection with the target agent
      const existingConnection = connections.find(
        conn => conn.targetAccountId === agentId && conn.status === 'established'
      );
      
      if (existingConnection) {
        connectionTopicId = existingConnection.connectionTopicId;
        console.log(`✅ Using existing connection! Topic ID: ${connectionTopicId}`);
      } else {
        console.log('❌ No existing connection found');
        
        // Try one more method - get connections file
        try {
          console.log('Attempt 3: Checking connections file...');
          const connectionsFile = path.join(process.cwd(), '.connections.json');
          const fileData = await fs.readFile(connectionsFile, 'utf8');
          const fileConnections = JSON.parse(fileData);
          
          if (fileConnections && fileConnections.length > 0) {
            const validConnection = fileConnections.find(
              conn => conn.connectionTopicId && /^0\.0\.\d+$/.test(conn.connectionTopicId)
            );
            
            if (validConnection) {
              connectionTopicId = validConnection.connectionTopicId;
              console.log(`✅ Using connection from file! Topic ID: ${connectionTopicId}`);
            } else {
              throw new Error('No valid connections found in file');
            }
          } else {
            throw new Error('No connections found in file');
          }
        } catch (fileError) {
          console.error('❌ Error with method 3:', fileError);
          throw new Error('Failed to establish or find a connection');
        }
      }
    }
    
    // Start polling for messages on this connection
    startPolling();
    
    return true;
  } catch (error) {
    console.error('❌ Error establishing connection:', error);
    return false;
  }
}

/**
 * Start polling for messages on the connection topic
 */
function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  console.log(`🔄 Starting to poll for messages on topic ${connectionTopicId}`);
  
  // Poll every 5 seconds
  pollingInterval = setInterval(async () => {
    try {
      await checkMessages();
    } catch (error) {
      console.error('❌ Error checking messages:', error);
    }
  }, 5000);
}

/**
 * Check for new messages
 */
async function checkMessages() {
  if (!connectionTopicId) return;

  try {
    const filter = {};
    if (lastMessageTimestamp) {
      filter.startTime = new Date(lastMessageTimestamp);
    }
    
    const messages = await client.getMessageStream(connectionTopicId, filter);
    
    if (messages && messages.length > 0) {
      console.log(`📩 Received ${messages.length} new messages`);
      
      // Process each message
      for (const message of messages) {
        processMessage(message);
        
        // Update timestamp for next polling
        if (message.created) {
          const timestamp = new Date(message.created).getTime();
          if (!lastMessageTimestamp || timestamp > lastMessageTimestamp) {
            lastMessageTimestamp = timestamp;
          }
        }
      }
    } else {
      process.stdout.write('.'); // Progress indicator
    }
  } catch (error) {
    console.error('❌ Error checking messages:', error);
  }
}

/**
 * Process a received message
 */
function processMessage(message) {
  try {
    console.log('\n=====================================');
    console.log('📩 MESSAGE RECEIVED:');
    console.log('-------------------------------------');
    
    // Try to parse fields from different message formats
    let contentText = '';
    let operation = message.op || 'unknown';
    
    // Extract the text content based on the message format
    if (message.text) {
      contentText = message.text;
    } else if (typeof message.data === 'string') {
      try {
        const parsedData = JSON.parse(message.data);
        contentText = parsedData.text || parsedData.message || parsedData.content || JSON.stringify(parsedData);
        operation = parsedData.op || operation;
      } catch (e) {
        contentText = message.data;
      }
    } else if (typeof message.data === 'object' && message.data !== null) {
      contentText = message.data.text || message.data.message || message.data.content || JSON.stringify(message.data);
    }
    
    // Log the parsed message details
    console.log(`Operation: ${operation}`);
    console.log(`Sequence: ${message.sequence_number}`);
    console.log(`Timestamp: ${message.created || 'unknown'}`);
    console.log(`Protocol: ${message.p || 'unknown'}`);
    console.log(`Content: ${contentText}`);
    console.log('=====================================\n');
  } catch (error) {
    console.error('❌ Error processing message:', error);
    console.log('Raw message:', message);
  }
}

/**
 * Send a message to the connected agent
 */
async function sendMessage(text) {
  if (!connectionTopicId) {
    console.log('❌ No active connection. Use "connect" first.');
    return false;
  }
  
  try {
    console.log(`🔄 Sending message: "${text}"`);
    
    // Create a proper HCS-10 message
    const message = {
      p: 'hcs-10',
      op: 'message',
      text: text,
      timestamp: new Date().toISOString()
    };
    
    // Send to the connection topic
    await client.sendMessage(connectionTopicId, JSON.stringify(message));
    
    console.log('✅ Message sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return false;
  }
}

/**
 * Display the help menu
 */
function showHelp() {
  console.log('\n=== HCS-10 Agent Test Client ===');
  console.log('Available commands:');
  console.log('  connect      - Establish connection to the agent');
  console.log('  send <text>  - Send a message to the agent');
  console.log('  status       - Show current connection status');
  console.log('  close        - Close the current connection');
  console.log('  exit         - Exit the test client');
  console.log('  help         - Show this help menu\n');
}

/**
 * Show current status
 */
function showStatus() {
  console.log('\n=== Current Status ===');
  console.log(`Agent ID: ${agentId || 'Not set'}`);
  console.log(`Connection: ${connectionTopicId ? 'ACTIVE' : 'INACTIVE'}`);
  
  if (connectionTopicId) {
    console.log(`Connection Topic: ${connectionTopicId}`);
  }
  
  console.log('\n');
}

/**
 * Close the connection
 */
async function closeConnection() {
  if (!connectionTopicId) {
    console.log('No active connection to close.');
    return;
  }
  
  try {
    // Send close_connection message
    const message = {
      p: 'hcs-10',
      op: 'close_connection',
      reason: 'Test complete'
    };
    
    await client.sendMessage(connectionTopicId, JSON.stringify(message));
    console.log('✅ Connection closed successfully');
    
    // Stop polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    
    connectionTopicId = null;
  } catch (error) {
    console.error('❌ Error closing connection:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting HCS-10 Agent Test Client...');
  
  if (!(await initialize())) {
    console.error('❌ Initialization failed. Exiting.');
    process.exit(1);
  }
  
  showHelp();
  
  // Process commands
  rl.on('line', async (input) => {
    const args = input.trim().split(' ');
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'connect':
        await connectToAgent();
        break;
        
      case 'send':
        const text = args.slice(1).join(' ');
        if (!text) {
          console.log('❌ Message text required. Usage: send <text>');
        } else {
          await sendMessage(text);
        }
        break;
        
      case 'status':
        showStatus();
        break;
        
      case 'close':
        await closeConnection();
        break;
        
      case 'help':
        showHelp();
        break;
        
      case 'exit':
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
        
      default:
        console.log('❌ Unknown command. Type "help" for available commands.');
    }
    
    rl.prompt();
  });
  
  // Set prompt
  rl.setPrompt('hcs10-test> ');
  rl.prompt();
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 