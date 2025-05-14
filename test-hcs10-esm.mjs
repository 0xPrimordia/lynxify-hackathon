#!/usr/bin/env node
/**
 * Test script for ES Module compatible HCS10 agent
 */

import { MockHCS10Client } from './dist-esm/lib/mock-hcs10-client.js';
import { HCS10AgentWithConnections } from './dist-esm/lib/hcs10-connection/hcs10-agent-with-connections.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set up test parameters
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '0.0.12345';
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '0.0.5956431';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '0.0.5956432';

console.log('Testing ES Module compatible HCS10 agent');
console.log(`Using operator ID: ${operatorId}`);
console.log(`Using inbound topic: ${inboundTopicId}`);
console.log(`Using outbound topic: ${outboundTopicId}`);

async function runTest() {
  try {
    // Create mock client
    console.log('Creating MockHCS10Client...');
    const client = new MockHCS10Client({
      operatorId,
      operatorPrivateKey: 'mock-key',
      network: 'testnet',
      inboundTopicId,
      outboundTopicId
    });
    
    // Create agent
    console.log('Creating HCS10AgentWithConnections...');
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
    });
    
    // Start polling
    console.log('Starting agent...');
    agent.start(5000);
    
    // Wait for ConnectionsManager initialization
    console.log('Waiting for ConnectionsManager to initialize...');
    const ready = await agent.waitUntilReady(30000);
    
    if (ready) {
      console.log('✅ Agent successfully initialized');
      
      // Test message sending
      console.log('Sending test message...');
      await client.sendMessage(inboundTopicId, JSON.stringify({
        p: 'hcs-10',
        op: 'message',
        data: JSON.stringify({
          type: 'TestMessage',
          content: 'Hello from ES Modules!'
        })
      }));
      
      // Let agent process the message
      console.log('Waiting for message processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('❌ Agent initialization timed out');
    }
    
    // Clean up
    console.log('Stopping agent...');
    agent.stop();
    
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runTest().catch(console.error); 