// combined-server.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Constants
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track server state
let serverState = {
  status: 'starting',
  agentInitialized: false,
  agentReady: false
};

// Create a MINIMAL server that starts immediately
const server = createServer((req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Basic health check endpoint that responds immediately
  if (req.url === '/api/health' || req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      serverUp: true,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Server status endpoint
  if (req.url === '/api/server-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...serverState,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Return a simple 404 for any other route for now
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
});

// Basic WebSocket server with minimal initialization
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send server status
  ws.send(JSON.stringify({
    type: 'server_status',
    status: serverState,
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Simple echo for now
      ws.send(JSON.stringify({
        type: 'echo',
        received: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Log startup sequence for debugging
console.log(`
===============================================
🚀 Starting Lynxify Server...
📡 Will bind to port: ${PORT}
🏁 Using Render deployment configuration
===============================================
`);

// Start the server FIRST - without any agent initialization
server.listen(PORT, () => {
  console.log(`
  ===============================================
  🚀 Lynxify Server Running!
  
  🌐 Server listening on port ${PORT}
  🔗 TCP listener active - should be detected by Render
  ✅ Health check: http://localhost:${PORT}/api/health
  ✅ Status: http://localhost:${PORT}/api/server-status
  ===============================================
  `);
  
  // Update server state
  serverState.status = 'running';
  
  // Now that the server is running, we can initialize the agent in the background
  // We'll do this by dynamically importing the agent handler to avoid any startup delays
  setTimeout(async () => {
    try {
      console.log('🔄 Starting lazy initialization of agent...');
      
      // Dynamically import the agent handler
      const { default: agentHandler } = await import('./scripts/hcs10/agent-handler.mjs');
      
      // Initialize the handler
      console.log('🔄 Initializing agent handler...');
      serverState.status = 'initializing_agent';
      
      // Setup server-side event handlers BEFORE initializing agent
      setupAgentEventHandlers(agentHandler, wss);
      
      // Now initialize the agent
      await agentHandler.initialize();
      console.log('✅ Agent handler initialized');
      
      // Update server state
      serverState.agentInitialized = true;
      serverState.status = 'agent_initialized';
      
      // Start monitoring after a delay
      setTimeout(async () => {
        try {
          console.log('🔄 Starting agent monitoring...');
          await agentHandler.startMonitoring();
          console.log('✅ Agent monitoring started');
          
          // Update server state
          serverState.agentReady = true;
          serverState.status = 'ready';
          
          // Broadcast status update to all connected WebSocket clients
          wss.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({
                type: 'server_status',
                status: serverState,
                timestamp: new Date().toISOString()
              }));
            }
          });
        } catch (error) {
          console.error('❌ Error starting agent monitoring:', error);
          serverState.status = 'agent_error';
          serverState.error = error.message;
        }
      }, 10000); // Wait 10 seconds before starting monitoring
    } catch (error) {
      console.error('❌ Error initializing agent:', error);
      serverState.status = 'agent_init_error';
      serverState.error = error.message;
    }
  }, 5000); // Wait 5 seconds before even starting to initialize the agent
});

// Helper function to set up agent event handlers
function setupAgentEventHandlers(agentHandler, wss) {
  // Listen for agent events and broadcast to WebSocket clients
  agentHandler.on('message_received', (message) => {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'agent_message',
          message,
          timestamp: new Date().toISOString()
        }));
      }
    });
  });
  
  agentHandler.on('connection_established', (connection) => {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'agent_connection',
          connection,
          timestamp: new Date().toISOString()
        }));
      }
    });
  });
  
  agentHandler.on('error', (error) => {
    console.error('Agent error:', error);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'agent_error',
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }));
      }
    });
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
}); 