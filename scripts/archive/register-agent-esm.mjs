#!/usr/bin/env node

/**
 * Agent Registration Script for Moonscape
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { HCS10Client, AgentBuilder, AIAgentCapability } from '@hashgraphonline/standards-sdk';
import { PrivateKey } from '@hashgraph/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get current directory for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REGISTRATION_STATUS_FILE = join(process.cwd(), '.registration_status.json');

// Initialize logger
const logger = console;

// Main function
async function main() {
  try {
    logger.info('==================================');
    logger.info('Lynxify Agent Registration Process');
    logger.info('==================================');
    
    // Check environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const registryTopic = process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC;
    
    if (!operatorId || !operatorKey) {
      logger.error('Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.');
      process.exit(1);
    }
    
    if (!registryTopic) {
      logger.error('Missing Moonscape registry topic. Set NEXT_PUBLIC_HCS_REGISTRY_TOPIC env variable.');
      process.exit(1);
    }
    
    logger.info(`Using account: ${operatorId}`);
    logger.info(`Using registry topic: ${registryTopic}`);
    
    // COMPLETE CONFIG following the standards-sdk exactly
    const config = {
      network: 'testnet',
      operatorId: operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug',
    };
    
    try {
      // Create client with exact config
      logger.info('Creating HCS10Client...');
      const client = new HCS10Client(config);
      
      // Create FULLY SPECIFIED agent builder with ALL required fields
      logger.info('Building agent with all required metadata...');
      const agentBuilder = new AgentBuilder()
        .setName('Lynxify Agent')
        .setDescription('AI-powered rebalancing agent for tokenized index')
        .setAlias('lynxify_agent')
        .setCapabilities([
          AIAgentCapability.TEXT_GENERATION,
          AIAgentCapability.KNOWLEDGE_RETRIEVAL
        ])
        .setCreator('Lynxify')
        .setModel('gpt-3.5-turbo')
        .setNetwork('testnet')
        .setType('ai');
      
      // Register agent
      logger.info('Registering agent...');
      const result = await client.createAndRegisterAgent(agentBuilder);
      
      if (result && result.metadata) {
        logger.info('✅ Agent successfully registered!');
        logger.info(`Account ID: ${result.metadata.accountId}`);
        logger.info(`Inbound Topic ID: ${result.metadata.inboundTopicId}`);
        logger.info(`Outbound Topic ID: ${result.metadata.outboundTopicId}`);
        
        // Store registration status
        const status = {
          accountId: result.metadata.accountId,
          inboundTopicId: result.metadata.inboundTopicId,
          outboundTopicId: result.metadata.outboundTopicId,
          registryTopic: registryTopic,
          timestamp: Date.now()
        };
        
        await writeFile(REGISTRATION_STATUS_FILE, JSON.stringify(status, null, 2));
        logger.info('Registration status stored to .registration_status.json');
        
        logger.info('You can verify this on Hashscan:');
        logger.info(`https://hashscan.io/testnet/account/${result.metadata.accountId}`);
      } else {
        logger.error('❌ Registration failed - Missing metadata in response');
      }
    } catch (error) {
      logger.error('❌ Registration error:', error.message);
      logger.error(error.stack);
    }
  } catch (error) {
    logger.error('Application error:', error);
  }
}

// Run the main function
main(); 