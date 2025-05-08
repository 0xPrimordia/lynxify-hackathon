// Simple combined server for Render deployment
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config({ path: '.env.local' });

console.log('=== ENVIRONMENT VARIABLES DEBUGGING ===');
console.log('NEXT_PUBLIC_OPERATOR_ID exists:', !!process.env.NEXT_PUBLIC_OPERATOR_ID);
console.log('OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
console.log('NEXT_PUBLIC_HCS_INBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC);
console.log('NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC);
console.log('NEXT_PUBLIC_HCS_PROFILE_TOPIC:', process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC);
console.log('==========================================');

// Create HTTP server for health checks
const server = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'healthy',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      topics: {
        inbound: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || 'not-configured',
        outbound: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || 'not-configured',
        profile: process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC || 'not-configured'
      }
    }));
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.send(JSON.stringify({
    type: 'system',
    data: {
      message: 'Connected to Lynxify Agent',
      timestamp: Date.now()
    }
  }));
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  // Every 10 seconds, send a heartbeat
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        data: {
          timestamp: Date.now()
        }
      }));
    }
  }, 10000);
  
  ws.on('close', () => {
    clearInterval(interval);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server active`);
  console.log(`🧠 Agent ready with topics:`);
  console.log(`   - Inbound: ${process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || 'not configured'}`);
  console.log(`   - Outbound: ${process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || 'not configured'}`);
  console.log(`   - Profile: ${process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC || 'not configured'}`);
}); 