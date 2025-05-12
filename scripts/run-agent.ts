#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { LynxifyAgent } from '../src/app/services/lynxify-agent';
import { EventBus, EventType } from '../src/app/utils/event-emitter';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Path to the approval commands file
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
// Path to connection state file
const CONNECTION_STATE_FILE = path.join(process.cwd(), '.connection_state.json');

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_OPERATOR_ID', 
  'OPERATOR_KEY',
  'NEXT_PUBLIC_HCS_AGENT_ID',
  'NEXT_PUBLIC_HCS_REGISTRY_TOPIC',
  'NEXT_PUBLIC_HCS_AGENT_TOPIC',
  'NEXT_PUBLIC_HCS_INDEX_TOPIC',
  'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
  'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

/**
 * Main function to run the Lynxify agent
 */
async function main() {
  console.log('🚀 Starting Lynxify Agent...');
  
  try {
    // Create the agent
    console.log('🔄 Creating LynxifyAgent instance...');
    const agent = new LynxifyAgent({
      agentId: process.env.NEXT_PUBLIC_HCS_AGENT_ID!,
      hederaConfig: {
        network: 'testnet',
        operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
        operatorKey: process.env.OPERATOR_KEY,
      },
      hcs10Config: {
        registryTopicId: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC!,
        agentTopicId: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
        capabilities: ['index', 'rebalancing'],
        description: 'Lynxify Tokenized Index Agent',
      },
      indexConfig: {
        indexTopicId: process.env.NEXT_PUBLIC_HCS_INDEX_TOPIC!,
        proposalTimeoutMs: 300000, // 5 minutes
        rebalanceThreshold: 0.05, // 5%
        riskThreshold: 0.2, // 20%
      },
      logEvents: true,
    });
    
    // Get the event bus
    const eventBus = EventBus.getInstance();
    
    // Setup event handlers
    setupEventHandlers(eventBus, agent);
    
    // Initialize the agent
    console.log('🔄 Initializing agent...');
    await agent.initialize();
    console.log('✅ Agent initialized successfully');
    
    // Periodically check for approval commands
    const checkInterval = setInterval(async () => {
      await checkApprovalCommands(agent);
      await saveConnectionState(agent);
    }, 5000);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, shutting down...');
      clearInterval(checkInterval);
      await agent.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down...');
      clearInterval(checkInterval);
      await agent.shutdown();
      process.exit(0);
    });
    
    // Keep the process running
    console.log('🔄 Agent is now running and monitoring HCS10 connections');
    console.log('🔄 Press Ctrl+C to stop');
  } catch (error) {
    console.error('❌ Error running agent:', error);
    process.exit(1);
  }
}

/**
 * Set up event handlers for the agent
 */
function setupEventHandlers(eventBus: EventBus, agent: LynxifyAgent) {
  // Connection-related events
  eventBus.onEvent(EventType.HCS10_AGENT_REGISTERED, (data) => {
    console.log(`✅ Agent registered with ID: ${data.agentId}`);
  });
  
  eventBus.onEvent(EventType.HCS10_AGENT_CONNECTED, (data) => {
    console.log(`✅ Agent connected and verified with ${data.capabilities?.length || 0} capabilities`);
  });
  
  eventBus.onEvent(EventType.HCS10_AGENT_DISCONNECTED, (data) => {
    console.log(`🔗 Agent disconnected: ${data.agentId}`);
  });
  
  eventBus.onEvent(EventType.HCS10_REQUEST_RECEIVED, (data) => {
    console.log(`📩 Request received from ${data.senderId}`);
  });
  
  // Handle system errors
  eventBus.onEvent(EventType.SYSTEM_ERROR, (error) => {
    console.error('❌ System error:', error);
  });
}

/**
 * Check for approval commands in the file
 */
async function checkApprovalCommands(agent: LynxifyAgent) {
  try {
    // Check if the file exists
    try {
      const data = await fs.readFile(APPROVAL_COMMAND_FILE, 'utf8');
      const commands = JSON.parse(data);
      
      if (commands.length > 0) {
        console.log(`📝 Found ${commands.length} approval commands to process`);
        
        // Process each command
        for (const command of commands) {
          if ((command.action === 'approve' || command.type === 'approve_connection') && command.connectionId) {
            try {
              console.log(`🔄 Processing approval for connection ${command.connectionId}`);
              
              const hcs10Service = agent.getHCS10Service();
              await hcs10Service.sendResponse(
                command.connectionId,
                command.connectionId,
                {
                  status: 'approved',
                  memo: command.memo || "Connection accepted. Looking forward to collaborating!",
                  profileInfo: {
                    version: "1.0",
                    type: 0,
                    display_name: "Lynxify Agent",
                    alias: "lynxify_agent",
                    bio: "Testnet agent for the Lynx tokenized index",
                    properties: {
                      organization: "Lynxify"
                    },
                    inboundTopicId: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
                    outboundTopicId: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
                  }
                }
              );
              
              console.log(`✅ Connection ${command.connectionId} approved`);
            } catch (error: any) {
              console.error(`❌ Error approving connection ${command.connectionId}:`, error);
            }
          }
        }
        
        // Clear the commands file
        await fs.writeFile(APPROVAL_COMMAND_FILE, JSON.stringify([], null, 2));
      }
    } catch (error: any) {
      // File doesn't exist yet or other error
      if (error.code !== 'ENOENT') {
        console.error('❌ Error checking approval commands:', error);
      }
    }
  } catch (error: any) {
    console.error('❌ Error processing approval commands:', error);
  }
}

/**
 * Save current connection state to a file
 */
async function saveConnectionState(agent: LynxifyAgent) {
  try {
    const hcs10Service = agent.getHCS10Service();
    const agents = hcs10Service.getKnownAgents();
    
    if (agents.size > 0) {
      const connections = Array.from(agents.values()).map(agent => ({
        agentId: agent.agentId,
        topicId: agent.topicId,
        capabilities: agent.capabilities,
        lastSeen: agent.lastSeen,
        description: agent.description,
        status: agent.status
      }));
      
      await fs.writeFile(
        CONNECTION_STATE_FILE,
        JSON.stringify(connections, null, 2),
        'utf8'
      );
    }
  } catch (error: any) {
    console.error('❌ Error saving connection state:', error);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 