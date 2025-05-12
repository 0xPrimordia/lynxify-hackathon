import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  try {
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
    
    if (!operatorId || !operatorKey || !agentId) {
      throw new Error('Missing required environment variables');
    }
    
    console.log(`Creating HCS10 client for agent ${agentId}...`);
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey
    });
    
    // Create ConnectionsManager
    console.log('Creating ConnectionsManager...');
    const connectionsManager = new ConnectionsManager({
      baseClient: client
    });
    
    // Fetch connections data
    console.log('Fetching connection data...');
    await connectionsManager.fetchConnectionData(agentId);
    
    // Get active connections
    const activeConnections = connectionsManager.getActiveConnections();
    console.log(`Found ${activeConnections.length} active connections`);
    
    if (activeConnections.length === 0) {
      console.log('No active connections found. Exiting...');
      rl.close();
      return;
    }
    
    // Display active connections
    console.log('\nActive connections:');
    activeConnections.forEach((conn, i) => {
      console.log(`${i+1}. ${conn.connectionTopicId} (from: ${conn.targetAccountId})`);
    });
    
    // Select a connection to test
    const selection = parseInt(await ask('\nSelect a connection to test (number): ')) - 1;
    
    if (isNaN(selection) || selection < 0 || selection >= activeConnections.length) {
      console.log('Invalid selection. Exiting...');
      rl.close();
      return;
    }
    
    const selectedConnection = activeConnections[selection];
    console.log(`\nSelected connection: ${selectedConnection.connectionTopicId}`);
    
    // Listen for messages and respond
    console.log('\nNow listening for messages on this connection...');
    console.log('(Press Ctrl+C to exit)');
    
    // Create a polling function to check for messages
    const pollMessages = async () => {
      try {
        // Get messages for this connection
        const messages = await client.getMessageStream(selectedConnection.connectionTopicId);
        
        // Process any new messages
        if (messages && messages.length > 0) {
          console.log(`Found ${messages.length} messages, processing the latest...`);
          const latestMessage = messages[messages.length - 1];
          
          let textContent = '';
          
          // Extract message content based on message format
          if (typeof latestMessage.data === 'string') {
            try {
              const parsedData = JSON.parse(latestMessage.data);
              textContent = parsedData.text || parsedData.message || parsedData.content;
            } catch (e) {
              // If not valid JSON, use as plain text
              textContent = latestMessage.data;
            }
          } else if (typeof latestMessage.data === 'object') {
            textContent = latestMessage.data.text || latestMessage.data.message || latestMessage.data.content;
          } else if (latestMessage.text) {
            textContent = latestMessage.text;
          } else if (latestMessage.message) {
            textContent = latestMessage.message;
          }
          
          if (textContent) {
            console.log(`\nReceived message: "${textContent}"`);
            
            // Generate response
            let responseText = '';
            const lowerText = textContent.toLowerCase();
            
            if (lowerText.includes('tell me about yourself') || lowerText.includes('who are you')) {
              responseText = "I am the Lynxify Rebalancer Agent, designed to help manage the Lynx tokenized index. I can assist with rebalancing operations, risk assessments, and tokenized asset management.";
            } 
            else if (lowerText.includes('help') || lowerText.includes('what can you do')) {
              responseText = "I can help with rebalancing token indexes, calculating optimal weights, monitoring price feeds, and executing token operations on the Hedera Token Service.";
            }
            else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
              responseText = "Hello! I'm the Lynxify Rebalancer Agent. How can I assist you with your tokenized index today?";
            }
            else {
              responseText = `Thank you for your message: "${textContent}". I am the Lynxify Rebalancer Agent, designed to help with tokenized index operations. How can I assist you further?`;
            }
            
            console.log(`Sending response: "${responseText}"`);
            
            // Simple format for chat message
            const response = {
              op: 'message',
              text: responseText,
              timestamp: new Date().toISOString()
            };
            
            // Send response directly to connection
            await client.sendMessage(
              selectedConnection.connectionTopicId,
              JSON.stringify(response)
            );
            
            console.log('Response sent successfully!');
            
            // Save last processed timestamp to avoid re-processing
            lastMessageTimestamp = latestMessage.timestamp;
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error.message);
      }
      
      // Continue polling
      setTimeout(pollMessages, 3000);
    };
    
    // Start polling
    pollMessages();
    
    // Wait for user to cancel
    await new Promise(() => {}); // Keep running until Ctrl+C
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

main().catch(console.error); 