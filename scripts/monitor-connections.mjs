#!/usr/bin/env node --experimental-specifier-resolution=node --experimental-import-meta-resolve
/**
 * Connection Monitor Script
 * Monitors connection events and helps diagnose connection issues
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fs from 'fs';
import { createRequire } from 'module';

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
const agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID || operatorId;

// Log formatting
const log = {
  info: (msg) => console.log(chalk.blue(`ℹ️ ${msg}`)),
  success: (msg) => console.log(chalk.green(`✅ ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`⚠️ ${msg}`)),
  error: (msg) => console.log(chalk.red(`❌ ${msg}`)),
  debug: (msg) => console.log(chalk.gray(`🔍 ${msg}`)),
  connection: (msg) => console.log(chalk.cyan(`🔗 ${msg}`)),
  message: (msg) => console.log(chalk.magenta(`📨 ${msg}`))
};

// Application entry point
async function main() {
  log.info('Starting Connection Monitor...');
  
  // Validate environment
  if (!operatorId || !operatorKey) {
    log.error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY');
    process.exit(1);
  }
  
  // Print environment info
  log.info('Environment:');
  log.info(`- Agent ID: ${agentId}`);
  log.info(`- Inbound Topic: ${inboundTopicId}`);
  log.info(`- Outbound Topic: ${outboundTopicId}`);
  
  // Dynamic imports to handle ES Module compatibility
  try {
    // Import client and agent classes
    log.info('Loading modules...');
    const { MockHCS10Client } = await import('../src/lib/mock-hcs10-client.ts');
    const { HCS10AgentWithConnections } = await import('../src/lib/hcs10-connection/hcs10-agent-with-connections.ts');
    
    // Create a mock client
    log.info('Creating mock HCS10 client...');
    const client = new MockHCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      inboundTopicId,
      outboundTopicId,
      logLevel: 'info'
    });
    
    // Create agent with connections
    log.info('Creating HCS10 agent with connections...');
    const agent = new HCS10AgentWithConnections(
      client,
      inboundTopicId,
      outboundTopicId,
      agentId
    );
    
    // Set up event handlers
    agent.on('connectionsManagerReady', () => {
      log.success('ConnectionsManager is ready');
      
      // Try to log connection info
      const cm = agent.getConnectionsManager();
      if (cm) {
        // Check connections
        try {
          // Different ConnectionsManager versions might have different methods
          if (typeof (cm).getConnectionStore === 'function') {
            const connections = (cm).getConnectionStore();
            log.connection(`Found ${connections.length} connections in store`);
          } else if (typeof (cm).listConnections === 'function') {
            const connections = (cm).listConnections();
            log.connection(`Found ${connections.length} connections via listConnections`);
          } else {
            log.warn('ConnectionsManager does not have getConnectionStore or listConnections method');
          }
        } catch (error) {
          log.error(`Error accessing connection store: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
    
    agent.on('connectionsManagerError', (error) => {
      log.error(`ConnectionsManager error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Check for specific error patterns
      const errorStr = String(error);
      if (errorStr.includes('Cannot find module')) {
        log.error('Module resolution error detected');
        log.info('Possible solution: Make sure @hashgraphonline/standards-sdk is installed correctly');
        log.info('Run: npm install @hashgraphonline/standards-sdk@0.0.95');
      } else if (errorStr.includes('not a function')) {
        log.error('Function compatibility error detected');
        log.info('Possible solution: Use proper ES Module / CommonJS interoperability patterns');
      }
    });
    
    agent.on('connectionAccepted', (connection) => {
      log.connection('New connection accepted:');
      console.log(JSON.stringify(connection, null, 2));
      
      // Save connection data for debugging
      const timestamp = Date.now();
      const filename = `connection-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(connection, null, 2));
      log.info(`Connection data saved to ${filename}`);
    });
    
    agent.on('message', (content, message) => {
      log.message(`Message received (seq: ${message.sequence_number})`);
      
      try {
        // Try to parse and log structured message content
        const parsed = JSON.parse(content);
        if (parsed.type) {
          log.message(`Message type: ${parsed.type}`);
        }
        
        // Check if it's a connection-related message
        if (parsed.type && parsed.type.includes('connection')) {
          log.connection('Connection-related message detected:');
          console.log(JSON.stringify(parsed, null, 2));
        }
      } catch (error) {
        // Not a JSON message or invalid format
        log.debug(`Message is not valid JSON: ${content.substring(0, 100)}...`);
      }
    });
    
    // Start the agent
    log.info('Starting agent...');
    agent.start(5000); // Poll every 5 seconds
    
    // Wait for ConnectionsManager to be ready
    log.info('Waiting for ConnectionsManager initialization...');
    const isReady = await agent.waitUntilReady(30000);
    if (isReady) {
      log.success('ConnectionsManager initialized successfully');
    } else {
      log.warn('ConnectionsManager initialization timed out or failed');
      log.info('Agent will continue to function but without ConnectionsManager functionality');
    }
    
    log.success('Monitor running. Press Ctrl+C to stop');
    
    // Keep the process running
    process.stdin.resume();
    
    // Handle process termination
    process.on('SIGINT', () => {
      log.info('Stopping monitor...');
      agent.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log.info('Stopping monitor...');
      agent.stop();
      process.exit(0);
    });
  } catch (error) {
    log.error(`Failed to initialize monitor: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 