import { LynxifyAgent, LynxifyAgentConfig } from '../services/lynxify-agent';
import { HCS10ProtocolService } from '../services/hcs10-protocol';
import { SharedHederaService } from '../services/shared-hedera-service';
import { EventBus, EventType } from '../utils/event-emitter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Agent configuration
const agentConfig: LynxifyAgentConfig = {
  agentId: process.env.AGENT_ID || `lynxify-agent-${Date.now()}`,
  hederaConfig: {
    network: (process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'custom',
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    operatorKey: process.env.OPERATOR_KEY
  },
  hcs10Config: {
    registryTopicId: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC || '',
    agentTopicId: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
    capabilities: [
      'price-feed',
      'risk-assessment',
      'rebalancing',
      'governance'
    ],
    description: 'Lynxify Tokenized Index Agent with HCS10 Protocol Support'
  },
  indexConfig: {
    indexTopicId: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '',
    proposalTimeoutMs: 60 * 60 * 1000, // 1 hour timeout for proposals
    rebalanceThreshold: 0.05, // 5% threshold for rebalancing
    riskThreshold: 0.2 // 20% threshold for risk alerts
  },
  logEvents: process.env.LOG_EVENTS === 'true'
};

/**
 * Main function to run the unified agent
 */
async function runAgent(): Promise<void> {
  console.log('🚀 Starting Lynxify Unified Agent...');
  
  try {
    // Create and initialize the agent
    const agent = new LynxifyAgent(agentConfig);
    await agent.initialize();
    
    console.log('✅ Lynxify Agent initialized and running');
    console.log(`🆔 Agent ID: ${agentConfig.agentId}`);
    
    // Setup shutdown handler for graceful exit
    setupProcessHandlers(agent);
    
    // Keep the process running
    keepAlive();
  } catch (error) {
    console.error('❌ Failed to start Lynxify Agent:', error);
    process.exit(1);
  }
}

/**
 * Setup process handlers for graceful shutdown
 */
function setupProcessHandlers(agent: LynxifyAgent): void {
  // Handle process termination signals
  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT signal, shutting down...');
    await agent.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM signal, shutting down...');
    await agent.shutdown();
    process.exit(0);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error);
    await agent.shutdown();
    process.exit(1);
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('❌ Unhandled rejection:', reason);
    // Don't exit for unhandled rejections, but log them
  });
}

/**
 * Keep the process alive until terminated
 */
function keepAlive(): void {
  console.log('✨ Agent is running...');
  
  // Setup a simple interval to keep the process alive
  const interval = setInterval(() => {
    // This prevents the Node.js process from exiting
  }, 1000 * 60 * 60); // Every hour
  
  // Clean up the interval on exit
  process.on('exit', () => {
    clearInterval(interval);
  });
}

// Run the agent
runAgent().catch(error => {
  console.error('❌ Fatal error running agent:', error);
  process.exit(1);
}); 