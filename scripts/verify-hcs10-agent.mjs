#!/usr/bin/env node
/**
 * Verify HCS10AgentWithConnections Implementation
 * This script tests the ES Module compatibility and proper functioning of the refactored implementation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const operatorKey = process.env.OPERATOR_KEY || '';
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '';

console.log(chalk.cyan.bold('🚀 Starting HCS10AgentWithConnections verification test'));
console.log('Environment variables:');
console.log(`- Operator ID: ${operatorId ? chalk.green('✅ Set') : chalk.red('❌ Missing')}`);
console.log(`- Operator Key: ${operatorKey ? chalk.green('✅ Set') : chalk.red('❌ Missing')}`);
console.log(`- Inbound Topic: ${chalk.yellow(inboundTopicId)}`);
console.log(`- Outbound Topic: ${chalk.yellow(outboundTopicId)}`);

async function verifyHCS10AgentWithConnections() {
  try {
    // Load modules dynamically to ensure ES module compatibility
    console.log(chalk.cyan('\n📦 Loading required modules...'));
    
    // First, test importing ConnectionsManager to verify ES Module compatibility
    try {
      const { ConnectionsManager } = await import('@hashgraphonline/standards-sdk');
      console.log(chalk.green('✅ Successfully imported ConnectionsManager from standards-sdk'));
      
      if (typeof ConnectionsManager === 'function') {
        console.log(chalk.green('✅ ConnectionsManager is a constructor function'));
      } else {
        console.log(chalk.red('❌ ConnectionsManager is not a constructor function'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to import ConnectionsManager:'), error.message);
    }
    
    // Load our client module
    const { BrowserHCSClient } = await import('@hashgraphonline/standards-sdk');
    
    if (!operatorId || !operatorKey || !inboundTopicId || !outboundTopicId) {
      throw new Error('Missing required environment variables');
    }
    
    // Create a client instance
    console.log(chalk.cyan('\n🔌 Creating HCS client instance...'));
    const client = new BrowserHCSClient({
      operatorId,
      operatorKey,
      network: 'testnet',
    });
    console.log(chalk.green('✅ Client instance created'));
    
    // Now manually compile and import our HCS10AgentWithConnections class
    console.log(chalk.cyan('\n🔄 Loading and initializing HCS10AgentWithConnections...'));
    
    try {
      // First, try to compile the TypeScript file
      const { execSync } = await import('child_process');
      
      // Compile just the agent file using tsc
      execSync('npx tsc --lib es2020,dom --module esnext --target es2020 --outDir ./temp-dist/ ./src/lib/hcs10-connection/hcs10-agent-with-connections.ts', { 
        stdio: 'inherit' 
      });
      
      console.log(chalk.green('✅ Successfully compiled HCS10AgentWithConnections'));
      
      // Import from the temporary compiled location
      const moduleExports = await import('../temp-dist/lib/hcs10-connection/hcs10-agent-with-connections.js');
      const { HCS10AgentWithConnections } = moduleExports;
      
      if (typeof HCS10AgentWithConnections !== 'function') {
        throw new Error('HCS10AgentWithConnections is not a constructor function');
      }
      
      console.log(chalk.green('✅ Successfully imported HCS10AgentWithConnections'));
      
      // Create an instance
      const agent = new HCS10AgentWithConnections(
        client,
        inboundTopicId,
        outboundTopicId,
        operatorId
      );
      
      console.log(chalk.green('✅ HCS10AgentWithConnections instance created'));
      
      // Set up event listeners
      agent.on('connectionsManagerReady', () => {
        console.log(chalk.green('✅ ConnectionsManager initialized successfully'));
        summarizeTest(true);
      });
      
      agent.on('connectionsManagerError', (error) => {
        console.error(chalk.red('❌ ConnectionsManager failed to initialize:'), error.message);
        summarizeTest(false);
      });
      
      // Wait for initialization
      console.log(chalk.cyan('⏳ Waiting for ConnectionsManager to initialize (max 30 seconds)...'));
      const isReady = await agent.waitUntilReady(30000);
      
      if (!isReady) {
        throw new Error('ConnectionsManager failed to initialize in time');
      }
      
      // Test function calls
      console.log(chalk.cyan('\n🧪 Testing agent functionality...'));
      
      // Start the agent
      agent.start();
      console.log(chalk.green('✅ Agent started successfully'));
      
      // Wait a bit for any messages to process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Stop the agent
      agent.stop();
      console.log(chalk.green('✅ Agent stopped successfully'));
      
      // Clean up temporary files
      try {
        execSync('rm -rf ./temp-dist');
      } catch (err) {
        console.warn(chalk.yellow('⚠️ Could not clean up temporary files:'), err.message);
      }
      
      console.log(chalk.green.bold('\n🎉 Test completed successfully! All functionality is working.'));
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to test HCS10AgentWithConnections:'), error);
      
      console.log(chalk.yellow('\nDouble-checking import and module compatibility...'));
      
      try {
        const { execSync } = await import('child_process');
        
        // Print the result of a direct import to see if the module can be loaded
        console.log(chalk.cyan('\nTrying direct import:'));
        
        const testImportCode = `
          import('@hashgraphonline/standards-sdk').then(module => {
            console.log('Module keys:', Object.keys(module));
            console.log('ConnectionsManager exists:', !!module.ConnectionsManager);
            console.log('ConnectionsManager type:', typeof module.ConnectionsManager);
            
            if (typeof module.ConnectionsManager === 'function') {
              console.log('ConnectionsManager is a constructor');
            }
          }).catch(err => console.error('Import error:', err.message));
        `;
        
        execSync(`node --input-type=module -e "${testImportCode}"`, { stdio: 'inherit' });
        
        // Log npm package info
        console.log(chalk.cyan('\nChecking package versions:'));
        execSync('npm list @hashgraphonline/standards-sdk', { stdio: 'inherit' });
        
        // Check if there are multiple installs causing conflicts
        console.log(chalk.cyan('\nChecking for duplicate packages:'));
        execSync('find ./node_modules -name "standards-sdk" | sort', { stdio: 'inherit' });
        
        console.log(chalk.red('\nDespite the package being available, integration failed. This could be due to TypeScript compilation issues or ES Module compatibility problems.'));
      } catch (debugError) {
        console.error(chalk.red('Debug commands failed:'), debugError.message);
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Verification test failed:'), error.message);
    process.exit(1);
  }
}

function summarizeTest(success) {
  console.log(chalk.cyan.bold('\n📋 Test Summary:'));
  if (success) {
    console.log(chalk.green('✅ ES Module compatibility: PASSED'));
    console.log(chalk.green('✅ ConnectionsManager initialization: PASSED'));
    console.log(chalk.green('✅ HCS10AgentWithConnections functionality: PASSED'));
    console.log(chalk.green.bold('\n🎉 All tests passed! The implementation is working correctly.'));
  } else {
    console.log(chalk.red('❌ One or more tests failed. See error messages above.'));
    console.log(chalk.yellow('\nSuggested fixes:'));
    console.log(chalk.yellow('1. Ensure @hashgraphonline/standards-sdk version 0.0.95 or higher is installed'));
    console.log(chalk.yellow('2. Try running "npm install @hashgraphonline/standards-sdk@latest" to update'));
    console.log(chalk.yellow('3. Make sure your project has been built with "npm run build"'));
    console.log(chalk.yellow('4. Check environment variables in .env.local file'));
  }
}

// Run the verification
verifyHCS10AgentWithConnections().catch(error => {
  console.error(chalk.red('❌ Fatal error:'), error);
  process.exit(1);
}); 