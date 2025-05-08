import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Monitor messages on HCS-10 agent topics
 */
async function main() {
  try {
    console.log('🚀 Starting HCS-10 agent monitor...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    // Get topic IDs from environment
    const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
    const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
    
    if (!inboundTopicId || !outboundTopicId) {
      throw new Error('Missing required topic IDs. Check your .env.local file.');
    }
    
    console.log(`
    Monitoring agent topics:
    * Inbound Topic: ${inboundTopicId}
    * Outbound Topic: ${outboundTopicId}
    `);
    
    // Create HCS10 client
    console.log('🔄 Creating HCS10 client...');
    const client = new HCS10Client({
      network: 'testnet',
      operatorId: operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Start monitoring inbound topic for messages
    console.log('👂 Monitoring inbound topic for messages...');
    console.log('ℹ️ Press Ctrl+C to stop monitoring');
    
    // Get messages from inbound topic
    try {
      const messages = await client.getMessageStream(inboundTopicId);
      
      if (messages && messages.length > 0) {
        console.log(`✅ Found ${messages.length} existing messages in inbound topic`);
        
        // Display each message
        messages.forEach((message, index) => {
          console.log(`\nMessage #${index + 1}:`);
          console.log(JSON.stringify(message, null, 2));
        });
      } else {
        console.log('ℹ️ No existing messages found in inbound topic');
      }
      
      // Continue monitoring for new messages
      console.log('\n👂 Monitoring for new messages...');
      
      // Keep the script running
      setInterval(() => {
        console.log('⏰ Still monitoring... (waiting for messages)');
      }, 10000);
      
    } catch (error) {
      console.error('❌ Error monitoring inbound topic:', error);
    }
    
  } catch (error) {
    console.error('❌ Error starting agent monitor:', error);
    process.exit(1);
  }
}

// Run the monitoring process
main(); 