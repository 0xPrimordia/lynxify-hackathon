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

console.log(`⚡ WebSocket server starting on port ${WS_PORT}...`);
console.log('⚡ ENVIRONMENT DEBUG:');
console.log('⚡ NODE_ENV:', process.env.NODE_ENV);
console.log('⚡ NEXT_PUBLIC_OPERATOR_ID exists:', !!process.env.NEXT_PUBLIC_OPERATOR_ID);
console.log('⚡ OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
console.log('⚡ NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC:', process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC);
console.log('⚡ NEXT_PUBLIC_HCS_AGENT_TOPIC:', process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC);
console.log('⚡ NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC:', process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC);

// Topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
const priceFeedTopic = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req: any) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🟢 CLIENT CONNECTED! IP: ${clientIp}`);
  console.log(`🟢 Current client count: ${clients.size + 1}`);
  console.log(`🟢 Headers: ${JSON.stringify(req.headers, null, 2).substring(0, 200)}...`);
  
  clients.add(ws);

  // Log all client messages
  ws.on('message', (message) => {
    console.log(`📩 RECEIVED WEBSOCKET MESSAGE FROM CLIENT: ${message.toString().substring(0, 300)}...`);
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log(`📩 PARSED MESSAGE TYPE: ${parsedMessage.type}`);
      console.log(`📩 FULL PARSED MESSAGE: ${JSON.stringify(parsedMessage, null, 2).substring(0, 500)}...`);
    } catch (e) {
      console.error('❌ FAILED TO PARSE MESSAGE:', e);
    }
  });

  ws.on('close', () => {
    console.log('🔴 CLIENT DISCONNECTED');
    console.log(`🔴 Remaining clients: ${clients.size - 1}`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WEBSOCKET CLIENT ERROR:', error);
  });

  // Send a welcome message
  try {
    const welcomeMsg = JSON.stringify({
      type: 'system',
      data: {
        message: 'Connected to Lynxify HCS Message Feed',
        timestamp: new Date().toISOString()
      }
    });
    ws.send(welcomeMsg);
    console.log('✅ WELCOME MESSAGE SENT TO CLIENT');
  } catch (error) {
    console.error('❌ ERROR SENDING WELCOME MESSAGE:', error);
  }
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
        console.log(`📨 RECEIVED GOVERNANCE MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
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
        console.log(`📨 RECEIVED AGENT MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
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
        console.log(`📨 RECEIVED PRICE FEED MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
        broadcastMessage({
          type: 'price-feed',
          data: message
        });
      }
    );

    console.log('✅ Successfully subscribed to all HCS topics');
  } catch (error) {
    console.error('❌ ERROR SUBSCRIBING TO TOPICS:', error);
    // Continue execution instead of exiting
    console.log('⚠️ Continuing WebSocket server operation despite topic subscription errors');
  }
}

// Broadcast message to all connected clients
function broadcastMessage(message: BroadcastMessage) {
  const messageStr = JSON.stringify(message);
  console.log(`📢 BROADCASTING MESSAGE TO ${clients.size} CLIENTS: ${messageStr.substring(0, 100)}...`);
  
  let sentCount = 0;
  clients.forEach((client: WebSocket) => {
    if (client.readyState === ws.OPEN) {
      try {
        client.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error('❌ ERROR SENDING BROADCAST:', error);
      }
    }
  });
  console.log(`📢 MESSAGE SENT TO ${sentCount}/${clients.size} CLIENTS`);
}

// Start server
subscribeToTopics().catch(error => {
  console.error('❌ FATAL ERROR STARTING HCS SUBSCRIPTIONS:', error);
}); 