#!/usr/bin/env node

/**
 * Test: test-connection-api-methods
 * 
 * Purpose: Tests the ConnectionsManager API methods to diagnose why
 * connection creation is failing in the test client.
 * 
 * This script attempts to:
 * 1. Instantiate ConnectionsManager with different configurations
 * 2. List available methods on the ConnectionsManager instance
 * 3. Test each connection-related method with proper parameters
 * 4. Compare available methods with those used in the Standards Expert
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Setup path and environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

// Test results
const results = {
  managerInitialization: { success: false, error: null },
  availableMethods: [],
  methodTests: {},
  recommendations: []
};

async function main() {
  console.log('🔍 Testing ConnectionsManager API methods...');
  
  try {
    // First try to dynamically import the SDK
    console.log('📦 Importing Standards SDK...');
    const { HCS10Client, ConnectionsManager } = await import('@hashgraphonline/standards-sdk');
    
    // Show what we're working with
    console.log('📄 SDK Exports:');
    console.log('- HCS10Client: ', typeof HCS10Client);
    console.log('- ConnectionsManager: ', typeof ConnectionsManager);
    
    // Try to initialize a client
    console.log('\n🔄 Initializing HCS10Client...');
    const client = new HCS10Client();
    
    // Test client operations
    console.log('\n📋 Client Methods:');
    const clientMethods = Object.getOwnPropertyNames(HCS10Client.prototype);
    console.log(clientMethods);
    
    // Load credentials
    const credentials = await loadCredentials();
    console.log('\n🔑 Using credentials:');
    console.log(`- Account ID: ${credentials.accountId}`);
    console.log(`- Private Key: ${credentials.privateKey ? '***' + credentials.privateKey.substring(credentials.privateKey.length - 4) : 'Not found'}`);
    
    // Initialize client with credentials
    if (credentials.accountId && credentials.privateKey) {
      await client.initAccount(credentials.accountId, credentials.privateKey);
      console.log('✅ Client initialized with credentials');
    } else {
      console.log('❌ Missing credentials, continuing with anonymous client');
    }
    
    // Try to initialize a ConnectionsManager
    console.log('\n🔄 Initializing ConnectionsManager...');
    let connectionsManager;
    
    try {
      connectionsManager = new ConnectionsManager(client);
      results.managerInitialization = { success: true, error: null };
      console.log('✅ ConnectionsManager initialized');
    } catch (error) {
      results.managerInitialization = { success: false, error: error.message };
      console.error(`❌ ConnectionsManager initialization failed: ${error.message}`);
      results.recommendations.push('Check if your SDK version supports ConnectionsManager');
    }
    
    // If initialization succeeded, test available methods
    if (connectionsManager) {
      console.log('\n📋 ConnectionsManager Methods:');
      const managerMethods = Object.getOwnPropertyNames(ConnectionsManager.prototype);
      results.availableMethods = managerMethods;
      console.log(managerMethods);
      
      // Test specific methods we need
      const methodsToTest = [
        'createConnectionRequest',
        'fetchConnectionData',
        'getConnectionRequests',
        'acceptConnectionRequest'
      ];
      
      console.log('\n🧪 Testing specific methods:');
      for (const method of methodsToTest) {
        if (managerMethods.includes(method)) {
          console.log(`- ${method}: ✅ Available`);
          results.methodTests[method] = { available: true };
          
          // Try to execute the method with basic parameters
          try {
            if (method === 'createConnectionRequest') {
              console.log(`  🔄 Testing ${method}...`);
              // This will likely fail but we want to see the error
              const result = await connectionsManager.createConnectionRequest(
                credentials.accountId, // agentId
                '0.0.12345'  // test agent ID
              );
              results.methodTests[method].execution = { success: true, result };
              console.log(`  ✅ ${method} executed successfully`);
            } else if (method === 'fetchConnectionData') {
              console.log(`  🔄 Testing ${method}...`);
              const result = await connectionsManager.fetchConnectionData();
              results.methodTests[method].execution = { success: true, result };
              console.log(`  ✅ ${method} executed successfully`);
            }
            // Add more method-specific tests here
          } catch (error) {
            results.methodTests[method].execution = { success: false, error: error.message };
            console.log(`  ❌ ${method} execution failed: ${error.message}`);
          }
        } else {
          console.log(`- ${method}: ❌ Not available`);
          results.methodTests[method] = { available: false };
          results.recommendations.push(`Method '${method}' not available - verify SDK version compatibility or implementation approach`);
        }
      }
    }
    
    // Compare with Standards Expert implementation
    console.log('\n🔍 Comparing with Standards Expert implementation...');
    const standardsExpertCode = await fs.readFile(path.join(PROJECT_ROOT, 'reference-examples/standards-agent-kit/examples/standards-expert/standards-expert-agent.ts'), 'utf8');
    
    const connectionMethodsInStandardsExpert = [
      'createConnectionRequest',
      'acceptConnectionRequest',
      'rejectConnectionRequest',
      'getConnectionRequests'
    ];
    
    for (const method of connectionMethodsInStandardsExpert) {
      const regex = new RegExp(`connectionsManager\\.${method}\\(`);
      const found = regex.test(standardsExpertCode);
      
      console.log(`- ${method}: ${found ? '✅ Used in Standards Expert' : '❌ Not found in Standards Expert'}`);
      
      if (found && (!results.availableMethods.includes(method) || (results.methodTests[method] && !results.methodTests[method].available))) {
        results.recommendations.push(`Method '${method}' is used in Standards Expert but not available in your SDK - consider updating SDK version`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
    results.recommendations.push('SDK import failed - ensure @hashgraphonline/standards-sdk is properly installed');
  }
  
  // Print recommendations
  console.log('\n📋 Recommendations:');
  if (results.recommendations.length === 0) {
    console.log('✅ No issues found');
  } else {
    for (const rec of results.recommendations) {
      console.log(`- ${rec}`);
    }
  }
  
  // Save results to a file
  await fs.writeFile(
    path.join(PROJECT_ROOT, 'connection-api-test-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n✅ Test results saved to connection-api-test-results.json');
}

async function loadCredentials() {
  // Try to get credentials from environment variables
  const accountId = process.env.AGENT_ID || process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  
  // If not in environment, try to get from a file
  if (!accountId || !privateKey) {
    try {
      const credsFilePath = path.join(PROJECT_ROOT, '.agent-credentials.json');
      const credsData = await fs.readFile(credsFilePath, 'utf8');
      const creds = JSON.parse(credsData);
      return {
        accountId: creds.accountId || creds.agentId,
        privateKey: creds.privateKey
      };
    } catch (err) {
      console.log('No credentials file found, checking for test credentials');
      
      // Try to get from test-credentials.json
      try {
        const testCredsPath = path.join(PROJECT_ROOT, 'test-credentials.json');
        const testCredsData = await fs.readFile(testCredsPath, 'utf8');
        const testCreds = JSON.parse(testCredsData);
        return {
          accountId: testCreds.identityId,
          privateKey: testCreds.identityKey
        };
      } catch (err2) {
        console.log('No test credentials found either');
      }
    }
  }
  
  return { accountId, privateKey };
}

main().catch(console.error); 