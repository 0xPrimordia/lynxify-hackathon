// combined-server.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import agentHandler from './scripts/hcs10/agent-handler.mjs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Constants
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize server FIRST!
const server = createServer((req, res) => {
  if (req.url === '/api/health') {
    // Health check endpoint
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', agent: true }));
    return;
  }

  if (req.url === '/api/agent-status') {
    // Agent status endpoint
    const status = agentHandler.initialized ? {
      ...agentHandler.getStatus(),
      registered: Boolean(agentHandler.agentId),
      status: agentHandler.monitoring ? 'running' : 'initialized'
    } : {
      status: 'starting',
      registered: false
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  // Return 404 for all other routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to Lynxify HCS-10 Agent Server'
  }));
  
  // Send current agent status
  ws.send(JSON.stringify({
    type: 'agent_status',
    status: agentHandler.initialized ? agentHandler.getStatus() : { status: 'starting' },
    timestamp: new Date().toISOString()
  }));

  // Handle messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received from WebSocket:', data);

      // Handle agent-related commands only if agent is initialized
      if (data.type === 'agent_command' && agentHandler.initialized) {
        switch (data.command) {
          case 'send_message':
            if (data.connectionTopicId && data.content) {
              const result = await agentHandler.sendMessage(
                data.connectionTopicId,
                data.content
              );
              
              ws.send(JSON.stringify({
                type: 'command_result',
                command: 'send_message',
                success: !!result,
                result,
                timestamp: new Date().toISOString()
              }));
            } else {
              throw new Error('Missing connectionTopicId or content');
            }
            break;
            
          case 'get_status':
            ws.send(JSON.stringify({
              type: 'agent_status',
              status: agentHandler.getStatus(),
              timestamp: new Date().toISOString()
            }));
            break;
            
          default:
            throw new Error(`Unknown command: ${data.command}`);
        }
      } else {
        // Echo back message for testing
        ws.send(JSON.stringify({
          type: 'response',
          message: `Received: ${data.message || 'No message content'}`,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Error processing your message',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start the server FIRST - before any agent initialization
server.listen(PORT, async () => {
  console.log(`
  ===============================================
  🚀 Lynxify HCS-10 Agent Server Starting!
  
  🌐 Server listening on port ${PORT}
  🔗 API: http://localhost:${PORT}/api
  🔌 WebSocket: ws://localhost:${PORT}
  
  📝 Agent Status: Initializing...
  
  ✅ Health check: http://localhost:${PORT}/api/health
  ✅ Agent status: http://localhost:${PORT}/api/agent-status
  ===============================================
  `);

  // NOW initialize the agent AFTER the server is up
  try {
    console.log('🚀 Initializing HCS-10 Agent Handler...');
    await agentHandler.initialize();
    console.log('✅ HCS-10 Agent Handler initialized');
    
    // Set up event handlers for agent
    agentHandler.on('message_received', (message) => {
      console.log('📩 Agent received message:', message);
      
      // Broadcast message to all WebSocket clients
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
      console.log('🔗 Agent established connection:', connection);
      
      // Broadcast connection to all WebSocket clients
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
    
    // Start monitoring inbound topic AFTER server is up and running
    // This is the part that was blocking the server startup
    console.log('Starting agent monitoring...');
    
    // Start with a delay to ensure server is fully responsive
    setTimeout(async () => {
      try {
        await agentHandler.startMonitoring();
        console.log('✅ HCS-10 Agent monitoring started');
        // Update all clients with agent status
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'agent_status',
              status: agentHandler.getStatus(),
              timestamp: new Date().toISOString()
            }));
          }
        });
      } catch (monitorError) {
        console.error('❌ Error starting monitoring:', monitorError);
      }
    }, 5000); // 5-second delay before starting monitoring
    
  } catch (error) {
    console.error('❌ Error initializing HCS-10 Agent:', error);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  
  // Stop agent monitoring
  if (agentHandler.initialized) {
    agentHandler.stopMonitoring();
  }
  
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
}); 