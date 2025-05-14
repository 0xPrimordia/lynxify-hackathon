#!/usr/bin/env node
/**
 * Minimal test script for ConnectionsManager
 * This script tests only the basic initialization of ConnectionsManager
 */

import dotenv from 'dotenv';
import { Client, PrivateKey } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: './.env.local' });

// Basic client setup for testing
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

async function testMinimalCM() {
  console.log('🔄 Testing minimal ConnectionsManager setup...');
  
  try {
    // Step 1: Create a basic Hedera client
    console.log('Creating Hedera client...');
    const client = Client.forName(network);
    const privateKey = PrivateKey.fromString(operatorKey);
    client.setOperator(operatorId, privateKey);
    
    // Step 2: Import ConnectionsManager
    console.log('Importing ConnectionsManager...');
    const { ConnectionsManager } = await import('@hashgraphonline/standards-sdk');
    
    // Step 3: Test with baseClient property
    console.log('Creating ConnectionsManager with baseClient...');
    const cm = new ConnectionsManager({
      baseClient: client,
      logLevel: 'info',
      prettyPrint: true
    });
    
    console.log('✅ ConnectionsManager created successfully!');
    console.log('ConnectionsManager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(cm)));
    
    return true;
  } catch (error) {
    console.error('❌ Error creating ConnectionsManager:', error);
    return false;
  }
}

// Run the test
testMinimalCM().catch(console.error); 