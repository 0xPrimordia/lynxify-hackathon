#!/usr/bin/env node
/**
 * Debug script for ConnectionsManager
 * This script inspects the ConnectionsManager class to understand what it expects
 */

import dotenv from 'dotenv';
import { Client, PrivateKey } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: './.env.local' });

// Basic client setup for testing
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

// Debug the ConnectionsManager class
async function debugConnectionsManager() {
  console.log('🔍 Debugging ConnectionsManager...');
  
  try {
    // Step 1: Print SDK Version and import details
    const packageJson = await import('./node_modules/@hashgraphonline/standards-sdk/package.json', { assert: { type: 'json' } });
    console.log(`📦 Package info: ${JSON.stringify({
      name: packageJson.default.name,
      version: packageJson.default.version,
      type: packageJson.default.type,
    }, null, 2)}`);
    
    // Step 2: Import the module and inspect the ConnectionsManager class
    const stdSDK = await import('@hashgraphonline/standards-sdk');
    
    // Check if ConnectionsManager exists
    if (!stdSDK.ConnectionsManager) {
      console.error('❌ ConnectionsManager not found in package');
      return;
    }
    
    console.log('✅ ConnectionsManager found in package');
    console.log(`ConnectionsManager constructor: ${stdSDK.ConnectionsManager.toString().slice(0, 500)}`);
    
    // Step 3: Create a minimal Hedera client
    const client = Client.forName(network);
    const privateKey = PrivateKey.fromString(operatorKey);
    client.setOperator(operatorId, privateKey);
    
    // Step 4: Debug object structure as it might appear to ConnectionsManager
    const clientOnly = { client };
    const baseClientOnly = { baseClient: client };
    const hybridClient = { client, baseClient: client };
    
    // Output the client objects structures
    console.log('\n📋 Client Structure Tests');
    console.log('1. Client Only:', Object.keys(clientOnly));
    console.log('2. BaseClient Only:', Object.keys(baseClientOnly));
    console.log('3. Hybrid Client:', Object.keys(hybridClient));
    
    // Step 5: Test minimal initialization with different client structures
    console.log('\n🧪 Testing ConnectionsManager initialization with different client structures');
    
    console.log('\nTest 1: Client Only');
    try {
      const cm1 = new stdSDK.ConnectionsManager(clientOnly);
      console.log('✅ SUCCESS - Connected with client only');
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
    }
    
    console.log('\nTest 2: BaseClient Only');
    try {
      const cm2 = new stdSDK.ConnectionsManager(baseClientOnly);
      console.log('✅ SUCCESS - Connected with baseClient only');
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
    }
    
    console.log('\nTest 3: Hybrid Client');
    try {
      const cm3 = new stdSDK.ConnectionsManager(hybridClient);
      console.log('✅ SUCCESS - Connected with hybrid client');
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
    }
    
    console.log('\nTest 4: Client Property as Option');
    try {
      const cm4 = new stdSDK.ConnectionsManager({ client });
      console.log('✅ SUCCESS - Connected with client as option');
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
    }
    
    console.log('\nTest 5: BaseClient Property as Option');
    try {
      const cm5 = new stdSDK.ConnectionsManager({ baseClient: client });
      console.log('✅ SUCCESS - Connected with baseClient as option');
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

// Run the debug function
debugConnectionsManager().catch(console.error); 