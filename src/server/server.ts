// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import type { WebSocket } from 'ws';
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
import { HederaService } from './services/hedera';

// Import types
import { HCSMessage } from './types/hcs';

interface BroadcastMessage {
  type: string;
  data: any;
}

// Constants
const WS_PORT = process.env.WS_PORT || 3001;

// Set fallback values for topics if not in environment
if (!process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC) {
  process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC = '0.0.5898548';
}
if (!process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC) {
  process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC = '0.0.5898549';
}
if (!process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC) {
  process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC = '0.0.5898550';
}

// Initialize WebSocket server
const wss = new WebSocketServer({ port: parseInt(WS_PORT.toString()) });
const hederaService = new HederaService();

// Store connected clients
const clients = new Set<WebSocket>();

console.log(`WebSocket server starting on port ${WS_PORT}...`);

// Topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
const priceFeedTopic = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;

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
      message: 'Connected to Lynxify HCS Message Feed'
    }
  }));
});

// Subscribe to HCS topics
async function subscribeToTopics() {
  try {
    console.log('Subscribing to topics:', {
      governance: governanceTopic,
      agent: agentTopic,
      priceFeed: priceFeedTopic
    });

    // Subscribe to governance topic
    await hederaService.subscribeToTopic(
      governanceTopic!,
      (message: any) => {
        broadcastMessage({
          type: 'governance',
          data: message
        });
      }
    );

    // Subscribe to agent topic
    await hederaService.subscribeToTopic(
      agentTopic!,
      (message: any) => {
        broadcastMessage({
          type: 'agent',
          data: message
        });
      }
    );

    // Subscribe to price feed topic
    await hederaService.subscribeToTopic(
      priceFeedTopic!,
      (message: any) => {
        broadcastMessage({
          type: 'price-feed',
          data: message
        });
      }
    );

    console.log('Successfully subscribed to all HCS topics');
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

// Start server
subscribeToTopics().catch(error => {
  console.error('Failed to start HCS subscriptions:', error);
}); 