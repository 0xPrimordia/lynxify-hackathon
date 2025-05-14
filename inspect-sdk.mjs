#!/usr/bin/env node
/**
 * Script to inspect ConnectionsManager methods from standards-sdk
 */

import * as sdk from '@hashgraphonline/standards-sdk';

// Check if ConnectionsManager exists
console.log('ConnectionsManager exists:', !!sdk.ConnectionsManager);

if (sdk.ConnectionsManager) {
  console.log('\nInspecting ConnectionsManager:');
  
  try {
    // Create a mock client for testing
    const mockClient = {
      network: 'testnet',
      operatorId: '0.0.12345',
      retrieveCommunicationTopics: () => ({}),
      getMessages: () => ([]),
      getMirrorClient: () => ({})
    };
    
    // Create instance
    const connectionsManager = new sdk.ConnectionsManager({
      baseClient: mockClient,
      logLevel: 'debug'
    });
    
    // Check instance creation
    console.log('Instance created successfully:', !!connectionsManager);
    
    // List all methods
    console.log('\nAvailable methods:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(connectionsManager))
      .filter(name => typeof connectionsManager[name] === 'function' && name !== 'constructor');
    
    methods.forEach(method => {
      console.log(`- ${method}`);
    });
    
    // List all properties
    console.log('\nAvailable properties:');
    const properties = Object.getOwnPropertyNames(connectionsManager)
      .filter(name => typeof connectionsManager[name] !== 'function');
    
    properties.forEach(prop => {
      console.log(`- ${prop}: ${typeof connectionsManager[prop]}`);
    });
    
    // Check specific methods
    const requiredMethods = [
      'setAgentInfo',
      'fetchConnectionData',
      'processInboundMessages',
      'getPendingRequests',
      'acceptConnectionRequest'
    ];
    
    console.log('\nRequired method check:');
    requiredMethods.forEach(method => {
      console.log(`- ${method}: ${typeof connectionsManager[method] === 'function' ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('Error inspecting ConnectionsManager:', error.message);
  }
} else {
  console.error('ConnectionsManager not found in @hashgraphonline/standards-sdk');
} 