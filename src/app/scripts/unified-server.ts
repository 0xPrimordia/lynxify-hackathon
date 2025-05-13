import { LynxifyAgent, LynxifyAgentConfig } from '../services/lynxify-agent';
import { UnifiedWebSocketService } from '../services/unified-websocket';
import { TokenService } from '../services/token-service';
import { TokenizedIndexService } from '../services/tokenized-index';
import { EventBus } from '../utils/event-emitter';
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
 * Main function to run the unified server
 */
async function runUnifiedServer(): Promise<void> {
  console.log(`
===============================================
🚀 Starting Lynxify Unified Server...
📡 Environment: ${process.env.NODE_ENV || 'development'}
📡 Port: ${process.env.PORT || process.env.WS_PORT || 3001}
===============================================
  `);
  
  // Log process environment
  console.log('🔍 Process environment:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`- PORT: ${process.env.PORT}`);
  console.log(`- WS_PORT: ${process.env.WS_PORT}`);
  console.log(`- cwd: ${process.cwd()}`);
  
  try {
    // Create and initialize the agent
    console.log('🔄 Creating and initializing LynxifyAgent...');
    const agent = new LynxifyAgent(agentConfig);
    await agent.initialize();
    
    console.log('✅ Lynxify Agent initialized');
    console.log(`🆔 Agent ID: ${agentConfig.agentId}`);
    
    // Initialize token service 
    console.log('🔄 Initializing Token Service...');
    const tokenService = new TokenService();
    
    // Get the index service from the agent
    const indexService = agent.getIndexService();
    
    // Initialize WebSocket server on port 3001 (or from env)
    const wsPort = parseInt(process.env.WS_PORT || process.env.PORT || '3001', 10);
    
    console.log(`🔌 Starting WebSocket server on port ${wsPort}...`);
    const webSocketService = new UnifiedWebSocketService(
      agent,
      tokenService,
      indexService,
      wsPort
    );
    
    console.log('✅ WebSocket server initialized and running');
    
    // Setup shutdown handlers
    setupShutdownHandlers(agent, webSocketService);
    
    console.log(`
    ===============================================
    🚀 Lynxify Unified Server Running!
    
    🔌 WebSocket server: ws://localhost:${wsPort}
    🌐 HTTP endpoints: http://localhost:${wsPort}
    
    ✅ Agent fully initialized with UI connection support
    ✅ Token operations and rebalance proposals enabled
    ✅ Connect to the WebSocket to interact with the agent
    ===============================================
    `);
    
    // Keep the process alive
    keepAlive();
  } catch (error) {
    console.error('❌ Failed to start Lynxify Unified Server:', error);
    process.exit(1);
  }
}

/**
 * Setup process handlers for graceful shutdown
 */
function setupShutdownHandlers(agent: LynxifyAgent, webSocketService: UnifiedWebSocketService): void {
  const shutdown = async () => {
    console.log('🛑 Shutting down server...');
    
    // Close WebSocket connections
    webSocketService.close();
    
    // Shutdown agent
    await agent.shutdown();
    
    console.log('✅ Server shutdown complete');
    process.exit(0);
  };
  
  // Handle process termination signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error);
    await shutdown();
    process.exit(1);
  });
}

/**
 * Keep the process alive until terminated
 */
function keepAlive(): void {
  // Setup a simple interval to keep the process alive
  const interval = setInterval(() => {
    // This prevents the Node.js process from exiting
  }, 60 * 60 * 1000); // Every hour
  
  // Clean up the interval on exit
  process.on('exit', () => {
    clearInterval(interval);
  });
}

// Run the server
runUnifiedServer().catch(error => {
  console.error('❌ Fatal error running unified server:', error);
  process.exit(1);
}); 