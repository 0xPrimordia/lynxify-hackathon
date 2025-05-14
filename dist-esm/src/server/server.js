"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const hedera_1 = require("./services/hedera");
const openconvai_1 = require("./services/openconvai");
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
const hederaService = new hedera_1.HederaService();
// Store connected clients
const clients = new Set();
console.log(`⚡ WebSocket server starting on port ${WS_PORT}...`);
console.log('⚡ ENVIRONMENT DEBUG:');
console.log('⚡ NODE_ENV:', process.env.NODE_ENV);
console.log('⚡ NEXT_PUBLIC_OPERATOR_ID exists:', !!process.env.NEXT_PUBLIC_OPERATOR_ID);
console.log('⚡ OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
console.log('⚡ NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC:', process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC);
console.log('⚡ NEXT_PUBLIC_HCS_AGENT_TOPIC:', process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC);
console.log('⚡ NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC:', process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC);
console.log('🔶 HCS-10: Using HCS-10 OpenConvAI standard for agent communication');
// Topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
const priceFeedTopic = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;
// Moonscape channels
const moonscapeInboundTopic = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const moonscapeOutboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
const moonscapeProfileTopic = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC;
// Handle WebSocket connections
wss.on('connection', (ws, req) => {
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
        }
        catch (e) {
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
                message: 'Connected to Lynxify HCS Message Feed (HCS-10 Enabled)',
                timestamp: new Date().toISOString()
            }
        });
        ws.send(welcomeMsg);
        console.log('✅ WELCOME MESSAGE SENT TO CLIENT');
    }
    catch (error) {
        console.error('❌ ERROR SENDING WELCOME MESSAGE:', error);
    }
});
// Initialize and register OpenConvAI agent
async function initializeOpenConvAI() {
    try {
        console.log('🚀 HCS-10: Initializing OpenConvAI agent...');
        // Initialize the OpenConvAI service
        await openconvai_1.openConvAIService.init();
        // Register the agent with the HCS-10 registry
        console.log('🚀 HCS-10: Registering agent with the HCS-10 registry...');
        const registrationResult = await openconvai_1.openConvAIService.registerAgent();
        if (registrationResult?.success) {
            console.log('✅ HCS-10: Agent successfully registered with the HCS-10 registry');
            if (registrationResult.transactionId) {
                console.log(`✅ HCS-10: Registration transaction ID: ${registrationResult.transactionId}`);
            }
        }
        else {
            console.log('⚠️ HCS-10: Agent registration with registry was not successful');
        }
        console.log('✅ HCS-10: OpenConvAI agent initialized successfully');
        return true;
    }
    catch (error) {
        console.error('❌ HCS-10 ERROR: Failed to initialize OpenConvAI agent:', error);
        // Continue execution instead of exiting
        console.log('⚠️ HCS-10: Continuing WebSocket server operation despite OpenConvAI initialization errors');
        return false;
    }
}
// Subscribe to HCS topics using OpenConvAI
async function subscribeToTopicsWithOpenConvAI() {
    try {
        console.log('🔄 HCS-10: Subscribing to topics with OpenConvAI:', {
            governance: governanceTopic,
            agent: agentTopic,
            priceFeed: priceFeedTopic,
            moonscapeInbound: moonscapeInboundTopic,
            moonscapeOutbound: moonscapeOutboundTopic
        });
        // Subscribe to traditional topics
        console.log(`🔄 HCS-10: Subscribing to governance topic ${governanceTopic}...`);
        await openconvai_1.openConvAIService.subscribeToTopic(governanceTopic, (message) => {
            console.log(`📨 HCS-10: RECEIVED GOVERNANCE MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'governance',
                data: message
            });
        });
        console.log(`🔄 HCS-10: Subscribing to agent topic ${agentTopic}...`);
        await openconvai_1.openConvAIService.subscribeToTopic(agentTopic, (message) => {
            console.log(`📨 HCS-10: RECEIVED AGENT MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'agent',
                data: message
            });
        });
        console.log(`🔄 HCS-10: Subscribing to price feed topic ${priceFeedTopic}...`);
        await openconvai_1.openConvAIService.subscribeToTopic(priceFeedTopic, (message) => {
            console.log(`📨 HCS-10: RECEIVED PRICE FEED MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'price-feed',
                data: message
            });
        });
        // Subscribe to Moonscape channels
        if (moonscapeInboundTopic) {
            console.log(`🔄 MOONSCAPE: Subscribing to inbound channel ${moonscapeInboundTopic}...`);
            await openconvai_1.openConvAIService.subscribeToTopic(moonscapeInboundTopic, (message) => {
                console.log(`📨 MOONSCAPE: RECEIVED INBOUND MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
                broadcastMessage({
                    type: 'moonscape-inbound',
                    data: message
                });
                // Process the inbound message and potentially send a response
                processInboundMessage(message);
            });
        }
        if (moonscapeOutboundTopic) {
            console.log(`🔄 MOONSCAPE: Monitoring outbound channel ${moonscapeOutboundTopic}...`);
            await openconvai_1.openConvAIService.subscribeToTopic(moonscapeOutboundTopic, (message) => {
                console.log(`📨 MOONSCAPE: OUTBOUND MESSAGE CONFIRMATION: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
                broadcastMessage({
                    type: 'moonscape-outbound',
                    data: message
                });
            });
        }
        console.log('✅ HCS-10: Successfully subscribed to all HCS topics with OpenConvAI');
        return true;
    }
    catch (error) {
        console.error('❌ HCS-10 ERROR: Failed to subscribe to topics with OpenConvAI:', error);
        // Fall back to traditional subscription method
        console.log('⚠️ HCS-10: Falling back to traditional HCS subscription method');
        return false;
    }
}
// Process inbound messages from Moonscape
async function processInboundMessage(message) {
    try {
        console.log('🔄 MOONSCAPE: Processing inbound message:', message.type);
        // Generate a response based on the message
        const response = {
            id: `response-${Date.now()}`,
            type: 'AgentResponse',
            timestamp: Date.now(),
            sender: 'Rebalancer Agent',
            details: {
                message: `This is an automated response from the Rebalancer Agent to your message of type: ${message.type}`,
                originalMessageId: message.id,
                rebalancerStatus: 'active'
            }
        };
        // Send the response to the outbound channel
        if (moonscapeOutboundTopic) {
            console.log('📤 MOONSCAPE: Sending response to outbound channel');
            await openconvai_1.openConvAIService.sendMessage(moonscapeOutboundTopic, response);
        }
    }
    catch (error) {
        console.error('❌ MOONSCAPE ERROR: Failed to process inbound message:', error);
    }
}
// Traditional subscription method (fallback)
async function subscribeToTopics() {
    try {
        console.log('🔄 FALLBACK: Subscribing to topics with traditional method:', {
            governance: governanceTopic,
            agent: agentTopic,
            priceFeed: priceFeedTopic
        });
        // Subscribe to governance topic
        await hederaService.subscribeToTopic(governanceTopic, (message) => {
            console.log(`📨 FALLBACK: RECEIVED GOVERNANCE MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'governance',
                data: message
            });
        });
        // Subscribe to agent topic
        await hederaService.subscribeToTopic(agentTopic, (message) => {
            console.log(`📨 FALLBACK: RECEIVED AGENT MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'agent',
                data: message
            });
        });
        // Subscribe to price feed topic
        await hederaService.subscribeToTopic(priceFeedTopic, (message) => {
            console.log(`📨 FALLBACK: RECEIVED PRICE FEED MESSAGE: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);
            broadcastMessage({
                type: 'price-feed',
                data: message
            });
        });
        console.log('✅ FALLBACK: Successfully subscribed to all HCS topics');
        return true;
    }
    catch (error) {
        console.error('❌ FALLBACK ERROR: Failed to subscribe to topics:', error);
        // Continue execution instead of exiting
        console.log('⚠️ FALLBACK: Continuing WebSocket server operation despite topic subscription errors');
        return true;
    }
}
// Broadcast message to all connected clients
function broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    console.log(`📢 BROADCASTING MESSAGE TO ${clients.size} CLIENTS: ${messageStr.substring(0, 100)}...`);
    let sentCount = 0;
    clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
            try {
                client.send(messageStr);
                sentCount++;
            }
            catch (error) {
                console.error('❌ ERROR SENDING BROADCAST:', error);
            }
        }
    });
    console.log(`📢 MESSAGE SENT TO ${sentCount}/${clients.size} CLIENTS`);
}
// Start server
async function startServer() {
    try {
        console.log('🚀 HCS-10: Starting server with HCS-10 OpenConvAI implementation');
        // First, initialize OpenConvAI
        const initResult = await initializeOpenConvAI();
        // Then try to subscribe using OpenConvAI
        const subscribeResult = await subscribeToTopicsWithOpenConvAI();
        // Log the status of HCS-10 integration
        if (initResult && subscribeResult) {
            console.log('✅ HCS-10: Successfully initialized and subscribed using HCS-10 OpenConvAI');
            // Send a test message to Moonscape if channels are configured
            if (moonscapeOutboundTopic) {
                await sendMoonscapeTestMessage();
            }
        }
        else {
            // Fall back to traditional method if either initialization or subscription failed
            console.log('⚠️ HCS-10: Falling back to traditional HCS subscription method');
            await subscribeToTopics();
        }
    }
    catch (error) {
        console.error('❌ FATAL ERROR STARTING SERVER:', error);
        // Continue with traditional method as fallback
        console.log('⚠️ FALLBACK: Using traditional subscription method due to HCS-10 failure');
        await subscribeToTopics();
    }
}
// Send a test message to Moonscape outbound channel
async function sendMoonscapeTestMessage() {
    try {
        if (!moonscapeOutboundTopic) {
            console.log('⚠️ MOONSCAPE: No outbound channel configured, skipping test message');
            return;
        }
        console.log('🔄 MOONSCAPE: Sending test message to outbound channel...');
        const testMessage = {
            id: `agent-info-${Date.now()}`,
            type: 'AgentInfo',
            timestamp: Date.now(),
            sender: 'Rebalancer Agent',
            details: {
                message: 'Rebalancer Agent is active and connected to Moonscape',
                agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                rebalancerStatus: 'ready'
            }
        };
        await openconvai_1.openConvAIService.sendMessage(moonscapeOutboundTopic, testMessage);
        console.log('✅ MOONSCAPE: Test message sent successfully to outbound channel');
    }
    catch (error) {
        console.error('❌ MOONSCAPE ERROR: Failed to send test message:', error);
    }
}
// Start the server
startServer().catch(error => {
    console.error('❌ FATAL ERROR INITIALIZING SERVER:', error);
});
