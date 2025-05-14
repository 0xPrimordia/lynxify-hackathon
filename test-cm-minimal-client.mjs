#!/usr/bin/env node
/**
 * Test script for ConnectionsManager with minimal client
 * This script specifically tests using a minimal client object with ConnectionsManager
 */

import dotenv from 'dotenv';
import { Client, PrivateKey } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: './.env.local' });

// Basic client setup for testing
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

async function testMinimalClientCM() {
  console.log('🔄 Testing ConnectionsManager with minimal client...');
  
  try {
    // Step 1: Create a basic Hedera client
    console.log('Creating Hedera client...');
    const client = Client.forName(network);
    const privateKey = PrivateKey.fromString(operatorKey);
    client.setOperator(operatorId, privateKey);
    
    // Step 2: Create a simple client object with just baseClient
    const minimalClient = { baseClient: client };
    console.log('Created minimal client:', Object.keys(minimalClient));
    
    // Step 3: Import ConnectionsManager
    console.log('Importing ConnectionsManager...');
    const { ConnectionsManager } = await import('@hashgraphonline/standards-sdk');
    
    // Step 4: Test with baseClient property
    console.log('Creating ConnectionsManager with minimal client...');
    const cm = new ConnectionsManager({
      client: minimalClient,
      logLevel: 'info',
      prettyPrint: true
    });
    
    console.log('✅ ConnectionsManager created successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating ConnectionsManager:', error);
    console.error('Error details:', error instanceof Error ? error.stack : JSON.stringify(error));
    return false;
  }
}

// Run the test
testMinimalClientCM().catch(console.error); 