// Load environment config first
import './src/app/config/env';

import type { WebSocket } from 'ws';
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const { HederaService } = require('./src/app/services/hedera');
const dotenv = require('dotenv');

interface HCSMessage {
  type: string;
  data: any;
}

interface BroadcastMessage {
  type: string;
  data: HCSMessage;
}

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Set environment variables for development
process.env.BYPASS_TOPIC_CHECK = 'true';

// HARDCODED VALUES FOR THE DEMO
process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.5898548';
process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.5898549';
process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.5898550';

const wss = new WebSocketServer({ port: 3001 });
const hederaService = new HederaService();

// Store connected clients
const clients = new Set<WebSocket>();

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Send a welcome message
  ws.send(JSON.stringify({
    type: 'system',
    data: {
      message: 'Connected to HCS Message Feed'
    }
  }));
});

// Subscribe to HCS topics
async function subscribeToTopics() {
  try {
    const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
    const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;

    console.log('Subscribing to topics:', {
      governance: governanceTopic,
      agent: agentTopic
    });

    // Subscribe to governance topic
    await hederaService.subscribeToTopic(
      governanceTopic!,
      (message: HCSMessage) => {
        broadcastMessage({
          type: 'governance',
          data: message
        });
      }
    );

    // Subscribe to agent topic
    await hederaService.subscribeToTopic(
      agentTopic!,
      (message: HCSMessage) => {
        broadcastMessage({
          type: 'agent',
          data: message
        });
      }
    );

    console.log('Subscribed to HCS topics');
  } catch (error) {
    console.error('Error subscribing to topics:', error);
    // Continue execution instead of exiting
    console.log('Continuing WebSocket server operation despite topic subscription errors');
  }
}

// Broadcast message to all connected clients
function broadcastMessage(message: BroadcastMessage) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client: WebSocket) => {
    if (client.readyState === ws.OPEN) {
      client.send(messageStr);
    }
  });
}

// Start the server
console.log('WebSocket server starting on port 3001...');
subscribeToTopics(); 