import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask questions
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Main function to test chat responses
 */
async function main() {
  try {
    console.log('🔄 Initializing chat response tester...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    
    if (!operatorId || !operatorKey || !agentId) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY, NEXT_PUBLIC_HCS_AGENT_ID');
    }
    
    console.log(`🔄 Creating HCS10 client for agent ${agentId}...`);
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Initialize ConnectionsManager
    console.log('🔄 Initializing ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({ 
      baseClient: client 
    });
    console.log('✅ ConnectionsManager initialized');
    
    // Load connections from ConnectionsManager
    console.log('🔄 Fetching connection data...');
    const connections = await connectionsManager.fetchConnectionData(agentId);
    console.log(`✅ Found ${connections.length} connections`);
    
    // Get active connections
    const activeConnections = connectionsManager.getActiveConnections();
    console.log(`✅ Found ${activeConnections.length} active connections`);
    
    // If no active connections found, exit
    if (activeConnections.length === 0) {
      console.log('❌ No active connections found. Please establish a connection first.');
      rl.close();
      return;
    }
    
    // Show active connections
    console.log('\n📝 Active connections:');
    activeConnections.forEach((conn, index) => {
      console.log(`${index + 1}. ID: ${conn.connectionTopicId}, Target: ${conn.targetAccountId}`);
    });
    
    // Ask user to select a connection
    const selection = await ask('\nEnter the number of the connection to test (or "exit" to quit): ');
    
    if (selection.toLowerCase() === 'exit') {
      console.log('👋 Exiting...');
      rl.close();
      return;
    }
    
    const selectedIndex = parseInt(selection) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= activeConnections.length) {
      console.log('❌ Invalid selection. Please run the script again and enter a valid number.');
      rl.close();
      return;
    }
    
    const selectedConnection = activeConnections[selectedIndex];
    console.log(`✅ Selected connection: ${selectedConnection.connectionTopicId}`);
    
    // Interactive chat mode
    console.log('\n📱 Starting interactive chat mode. Type "exit" to quit.');
    
    let chatting = true;
    while (chatting) {
      const message = await ask('\nEnter your message: ');
      
      if (message.toLowerCase() === 'exit') {
        chatting = false;
        continue;
      }
      
      console.log(`🔄 Sending message to ${selectedConnection.connectionTopicId}...`);
      
      try {
        // Try sending with multiple methods to ensure delivery
        
        // Method 1: Use sendChatMessage if available
        if (typeof client.sendChatMessage === 'function') {
          console.log('🔍 Using client.sendChatMessage method...');
          await client.sendChatMessage(
            selectedConnection.connectionTopicId,
            {
              text: message,
              timestamp: new Date().toISOString()
            }
          );
        } 
        // Method 2: Use standard sendMessage with JSON
        else {
          console.log('🔍 Using client.sendMessage method with JSON...');
          await client.sendMessage(
            selectedConnection.connectionTopicId,
            JSON.stringify({
              op: 'message',
              type: 'message',
              text: message,
              timestamp: new Date().toISOString()
            })
          );
        }
        
        console.log('✅ Message sent successfully');
        
        // Check for responses
        console.log('🔄 Checking for responses (waiting 5 seconds)...');
        
        // Wait for potential responses
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🔄 Fetching messages from connection...');
        const messages = await client.getMessageStream(selectedConnection.connectionTopicId);
        
        if (messages && messages.length > 0) {
          console.log(`✅ Found ${messages.length} messages on the connection`);
          
          // Show the last few messages (most recent first)
          const recentMessages = messages.slice(-5).reverse();
          
          console.log('\n📩 Recent messages:');
          recentMessages.forEach((msg, idx) => {
            const content = typeof msg.content === 'string' 
              ? msg.content 
              : JSON.stringify(msg.content || msg.data || {});
            
            console.log(`${idx + 1}. [${msg.timestamp || 'No timestamp'}] ${content}`);
          });
        } else {
          console.log('❌ No messages found on this connection');
        }
      } catch (error) {
        console.error('❌ Error sending or receiving messages:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in chat response tester:', error);
  } finally {
    rl.close();
  }
}

// Run the main function
main().catch(console.error); 