#!/usr/bin/env node
/**
 * Connection Test Script
 * 
 * This script tests sending a message to a connection topic to verify the connection status.
 * It will list all the connections from the HCS10 agent and attempt to send a test message.
 * 
 * Usage:
 *   node scripts/test-connection.mjs [connectionId]
 *   
 * If no connectionId is provided, it will list all connections and attempt to send a message
 * to the first one.
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');

async function main() {
  try {
    console.log('🔄 Connection Test Script');
    
    // Parse command line arguments
    const targetConnectionId = process.argv[2];
    
    // Step 1: Load connections from file
    console.log('🔄 Loading connections from file...');
    let connections = [];
    try {
      const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
      connections = JSON.parse(data);
      console.log(`✅ Loaded ${connections.length} connections`);
      
      if (connections.length === 0) {
        console.log('❌ No connections found. Please establish connections first.');
        return;
      }
      
      console.log('\n=== Connections ===');
      connections.forEach((conn, i) => {
        console.log(`${i+1}. ID: ${conn.id}`);
        console.log(`   Topic ID: ${conn.connectionTopicId}`);
        console.log(`   Requester: ${conn.requesterId}`);
        console.log(`   Status: ${conn.status || 'unknown'}`);
        console.log(`   Established: ${new Date(conn.establishedAt).toISOString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error loading connections:', error);
      console.log('Creating new HCS10 client to test connections...');
    }
    
    // Step 2: Create HCS10 client
    console.log('🔄 Creating HCS10 client...');
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      console.error('❌ Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
      process.exit(1);
    }
    
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Step 3: Find the connection to test
    let connectionToTest;
    
    if (targetConnectionId) {
      connectionToTest = connections.find(c => 
        c.id === targetConnectionId || 
        c.connectionTopicId === targetConnectionId
      );
      
      if (!connectionToTest) {
        console.error(`❌ Connection with ID ${targetConnectionId} not found`);
        process.exit(1);
      }
    } else {
      // Use the first connection if none specified
      connectionToTest = connections[0];
    }
    
    console.log(`🔄 Selected connection for testing:`);
    console.log(`   ID: ${connectionToTest.id}`);
    console.log(`   Topic ID: ${connectionToTest.connectionTopicId}`);
    
    // Step 4: Send a test message
    console.log('🔄 Sending test message to connection...');
    const testMessage = {
      type: 'test',
      message: 'This is a test message from the connection test script',
      timestamp: new Date().toISOString()
    };
    
    try {
      await client.sendMessage(
        connectionToTest.connectionTopicId,
        JSON.stringify(testMessage)
      );
      console.log('✅ Test message sent successfully!');
      console.log(`   Message sent to topic: ${connectionToTest.connectionTopicId}`);
      console.log('   This confirms the connection is active and functioning.');
    } catch (error) {
      console.error('❌ Error sending test message:', error);
      console.log(`   This indicates there may be an issue with the connection.`);
    }
    
  } catch (error) {
    console.error('❌ Error running connection test:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 