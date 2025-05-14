import { LynxifyAgent } from '../services/lynxify-agent';
import { UnifiedWebSocketService } from '../services/unified-websocket';
import { TokenService } from '../services/token-service';
import { createServer } from 'http';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config({ path: '.env.local' });
// Create a shared HTTP server that will be used by the WebSocketService
// This ensures the port is bound immediately for Render's port detection
const PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3000', 10);
console.log(`[Server] Creating HTTP server on port ${PORT} bound to 0.0.0.0`);
// Create HTTP server first (immediate port binding)
const sharedHttpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/' || req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'lynxify-unified-agent',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        }));
        return;
    }
    // Default response for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});
// Start HTTP server immediately to ensure port binding for Render
// CRITICAL: Explicitly bind to 0.0.0.0 as required by Render
sharedHttpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] HTTP server running at http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health check available at http://0.0.0.0:${PORT}/health`);
});
// Agent configuration
const agentConfig = {
    agentId: process.env.AGENT_ID || `lynxify-agent-${Date.now()}`,
    hederaConfig: {
        network: (process.env.HEDERA_NETWORK || 'testnet'),
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
async function runUnifiedServer() {
    console.log(`
===============================================
🚀 Starting Lynxify Unified Server...
📡 Environment: ${process.env.NODE_ENV || 'development'}
📡 Port: ${PORT} (bound to 0.0.0.0)
📡 HTTP server already running on port ${PORT}
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
        // Initialize WebSocket service using the shared HTTP server
        console.log(`🔌 Attaching WebSocket server to existing HTTP server on port ${PORT}...`);
        const webSocketService = new UnifiedWebSocketService(agent, tokenService, indexService, PORT, sharedHttpServer // Pass the already running HTTP server
        );
        console.log('✅ WebSocket server initialized and running');
        // Setup shutdown handlers
        setupShutdownHandlers(agent, webSocketService);
        console.log(`
    ===============================================
    🚀 Lynxify Unified Server Running!
    
    🔌 WebSocket server: ws://0.0.0.0:${PORT}
    🌐 HTTP endpoints: http://0.0.0.0:${PORT}
    
    ✅ Agent fully initialized with UI connection support
    ✅ Token operations and rebalance proposals enabled
    ✅ Connect to the WebSocket to interact with the agent
    ===============================================
    `);
        // Keep the process alive
        keepAlive();
    }
    catch (error) {
        console.error('❌ Failed to start Lynxify Unified Server:', error);
        // Don't exit on server initialization failure - keep the HTTP server running
        console.log('🔍 HTTP server remains active despite initialization failure');
    }
}
/**
 * Setup process handlers for graceful shutdown
 */
function setupShutdownHandlers(agent, webSocketService) {
    const shutdown = async () => {
        console.log('🛑 Shutting down server...');
        // Close WebSocket connections
        webSocketService.close();
        // Shutdown agent
        await agent.shutdown();
        // Close shared HTTP server
        sharedHttpServer.close(() => {
            console.log('✅ HTTP server closed');
            process.exit(0);
        });
        console.log('✅ Server shutdown initiated');
    };
    // Handle process termination signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('❌ Uncaught exception:', error);
        await shutdown();
    });
}
/**
 * Keep the process alive
 */
function keepAlive() {
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
    // Don't exit on server initialization failure - keep the HTTP server running
    console.log('🔍 HTTP server remains active despite initialization failure');
});
