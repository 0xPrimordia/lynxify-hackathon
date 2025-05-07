#!/usr/bin/env node

/**
 * SDK Inspection Tool
 * This script inspects the HCS-10 SDK to determine available functions
 */

import { HCS10Client, Logger } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function inspectSDK() {
  try {
    console.log('🔍 Inspecting HCS10Client SDK...');
    
    const client = new HCS10Client({
      network: 'testnet',
      operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
      operatorPrivateKey: process.env.OPERATOR_KEY || '',
      logLevel: 'debug'
    });
    
    console.log('\n📋 HCS10Client methods:');
    
    // Get all methods on the client instance
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
      .filter(name => typeof client[name] === 'function' && name !== 'constructor');
    
    // Print each method
    methods.forEach(method => {
      console.log(`   - ${method}`);
    });
    
    console.log('\n📋 HCS10Client properties:');
    
    // Get all properties
    const properties = Object.getOwnPropertyNames(client)
      .filter(name => typeof client[name] !== 'function');
    
    // Print each property
    properties.forEach(prop => {
      console.log(`   - ${prop}`);
    });
    
    // Check specifically for connection request methods
    console.log('\n🔍 Checking for connection request methods:');
    const connectionMethods = methods.filter(m => 
      m.toLowerCase().includes('connection') || 
      m.toLowerCase().includes('connect')
    );
    
    if (connectionMethods.length > 0) {
      console.log('✅ Found connection related methods:');
      connectionMethods.forEach(method => {
        console.log(`   - ${method}`);
      });
    } else {
      console.log('❌ No connection related methods found');
    }
    
    console.log('\n✅ SDK inspection complete');
  } catch (error) {
    console.error('❌ Error inspecting SDK:', error);
  }
}

// Run the inspection
inspectSDK().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
}); 