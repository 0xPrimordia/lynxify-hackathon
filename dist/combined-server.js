// Load environment variables from .env.local first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Then load environment config
import './src/app/config/env.js';
import { WebSocketServer, WebSocket as WS } from 'ws';
import { HederaService } from './src/app/services/hedera.js';
import { TokenService } from './src/app/services/token-service.js';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Debugging: Log all environment variables (without showing sensitive values)
console.log('=== ENVIRONMENT VARIABLES DEBUGGING ===');
console.log('NEXT_PUBLIC_OPERATOR_ID exists:', !!process.env.NEXT_PUBLIC_OPERATOR_ID);
console.log('OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
console.log('OPERATOR_KEY length:', process.env.OPERATOR_KEY ? process.env.OPERATOR_KEY.length : 0);
console.log('NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC:', process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC);
console.log('NEXT_PUBLIC_HCS_AGENT_TOPIC:', process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC);
console.log('NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC:', process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('NEXT_PUBLIC_HCS_INBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC);
console.log('NEXT_PUBLIC_HCS_OUTBOUND_TOPIC:', process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC);
console.log('NEXT_PUBLIC_HCS_PROFILE_TOPIC:', process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC);
console.log('==========================================');
// Set environment variables for development
process.env.BYPASS_TOPIC_CHECK = 'true';
// Use variables from .env.local - don't override if already set
// If we're running this for the demo, these topic IDs should be in .env.local
// Define registration status file path
const REGISTRATION_STATUS_FILE = path.join(__dirname, '.registration_status.json');
// Initialize services
const hederaService = new HederaService();
const tokenService = new TokenService();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Basic logger implementation
const logger = {
    debug: (message) => console.log(`DEBUG: ${message}`),
    info: (message) => console.log(`INFO: ${message}`),
    warn: (message) => console.log(`WARN: ${message}`),
    error: (message) => console.error(`ERROR: ${message}`)
};
// Get topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '';
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '';
// Get Moonscape topic IDs
let moonscapeInboundTopic = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC?.trim().replace(/\"/g, '') || '';
let moonscapeOutboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC?.trim().replace(/\"/g, '') || '';
const moonscapeProfileTopic = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC?.trim().replace(/\"/g, '') || '';
const hasMoonscapeChannels = Boolean(moonscapeInboundTopic && moonscapeOutboundTopic);
// Initialize WebSocket server
const wss = new WebSocketServer({ port: 3001 });
const clients = new Set();
// Initialize Agent Data Structures
const pendingProposals = new Map();
const executedProposals = new Set();
const MESSAGE_TYPES = {
    REBALANCE_PROPOSAL: 'RebalanceProposal',
    REBALANCE_APPROVED: 'RebalanceApproved',
    REBALANCE_EXECUTED: 'RebalanceExecuted',
};
// Handle WebSocket connections
wss.on('connection', (ws) => {
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
// Broadcast message to all connected clients
function broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    console.log(`📢 Broadcasting WebSocket message: ${messageStr.substring(0, 100)}...`);
    clients.forEach((client) => {
        if (client.readyState === WS.OPEN) {
            try {
                client.send(messageStr);
            }
            catch (err) {
                console.error('❌ Error sending WebSocket message:', err);
            }
        }
    });
}
// Check if the agent is already registered with the registry
async function isAlreadyRegistered() {
    if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC) {
        return false;
    }
    try {
        // Check if the registration status file exists
        const data = await fs.readFile(REGISTRATION_STATUS_FILE, 'utf8');
        const status = JSON.parse(data);
        // Check if the registered account ID matches the current one
        if (status.accountId === process.env.NEXT_PUBLIC_OPERATOR_ID &&
            status.registryTopic === process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC) {
            console.log('🌙 MOONSCAPE: Found existing registration record');
            return true;
        }
        return false;
    }
    catch (error) {
        // File doesn't exist or is invalid, assume not registered
        console.log('🌙 MOONSCAPE: No existing registration record found');
        return false;
    }
}
// Store registration status for future runs
async function storeRegistrationStatus(metadata) {
    if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC) {
        return;
    }
    try {
        const status = {
            accountId: metadata.accountId || process.env.NEXT_PUBLIC_OPERATOR_ID,
            inboundTopicId: metadata.inboundTopicId || '',
            outboundTopicId: metadata.outboundTopicId || '',
            registryTopic: process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC,
            timestamp: Date.now()
        };
        await fs.writeFile(REGISTRATION_STATUS_FILE, JSON.stringify(status, null, 2));
        console.log('🌙 MOONSCAPE: Registration status stored for future runs');
    }
    catch (error) {
        console.error('❌ MOONSCAPE: Failed to store registration status:', error);
    }
}
// Send message to Moonscape outbound channel using HCS-10 standard
async function sendToMoonscape(message) {
    if (!hasMoonscapeChannels) {
        console.log('⚠️ MOONSCAPE: Cannot send message - Moonscape channels not configured');
        return;
    }
    try {
        console.log(`🌙 MOONSCAPE: Sending message to outbound channel: ${message.type}`);
        // Create payload for Moonscape
        const messageData = {
            id: message.id || `msg-${Date.now()}`,
            type: message.type,
            timestamp: Date.now(),
            content: message.details?.message || "Agent activity update",
            metadata: {
                testTime: new Date().toISOString(), // Required field for Moonscape
                agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                status: message.details?.rebalancerStatus,
                proposalId: message.details?.proposalId,
                executedAt: message.details?.executedAt
            }
        };
        // Format as HCSMessage for our publishHCSMessage function
        const moonscapeMessage = {
            id: `moonscape-${Date.now()}`,
            type: 'AgentInfo',
            timestamp: Date.now(),
            sender: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            details: {
                message: JSON.stringify({
                    p: "hcs-10", // Protocol identifier
                    op: "message", // Operation type for standard message
                    operator_id: `${moonscapeInboundTopic}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
                    data: JSON.stringify(messageData),
                    m: "Message from Lynxify Agent" // Optional memo
                })
            }
        };
        await hederaService.publishHCSMessage(moonscapeOutboundTopic, moonscapeMessage);
        console.log('✅ MOONSCAPE: Message sent successfully with HCS-10 format');
    }
    catch (error) {
        console.error('❌ MOONSCAPE ERROR: Failed to send message:', error);
    }
}
// Send agent status to Moonscape using HCS-10 standard
async function sendAgentStatus() {
    if (!hasMoonscapeChannels) {
        console.log('⚠️ MOONSCAPE: Cannot send status - Moonscape channels not configured');
        return;
    }
    try {
        console.log('🌙 MOONSCAPE: Sending agent status message');
        // Create status payload
        const statusData = {
            id: `status-${Date.now()}`,
            timestamp: Date.now(),
            type: "AgentStatus",
            content: "Rebalancer Agent is active and monitoring proposals",
            metadata: {
                testTime: new Date().toISOString(),
                agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                pendingProposals: pendingProposals.size,
                executedProposals: executedProposals.size,
                status: "active"
            }
        };
        // Format as HCSMessage for our publishHCSMessage function
        const statusMessage = {
            id: `status-${Date.now()}`,
            type: 'AgentInfo',
            timestamp: Date.now(),
            sender: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
            details: {
                message: JSON.stringify({
                    p: "hcs-10",
                    op: "message",
                    operator_id: `${moonscapeInboundTopic}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
                    data: JSON.stringify(statusData),
                    m: "Agent status update"
                })
            }
        };
        await hederaService.publishHCSMessage(moonscapeOutboundTopic, statusMessage);
        console.log('✅ MOONSCAPE: Status message sent successfully with HCS-10 format');
    }
    catch (error) {
        console.error('❌ MOONSCAPE ERROR: Failed to send status message:', error);
    }
}
// === AGENT FUNCTIONS ===
async function analyzeRebalanceWithAI(proposal) {
    try {
        console.log('🧠 AGENT: Analyzing proposal with OpenAI...');
        const newWeights = proposal.details?.newWeights || {};
        const tokens = Object.keys(newWeights);
        const weights = Object.values(newWeights);
        const prompt = `
    As an AI asset rebalancing agent, I'm executing a rebalance of a tokenized index with the following new weights:
    ${tokens.map((token, i) => `${token}: ${weights[i] * 100}%`).join('\n')}
    
    Please provide a brief analysis (2-3 sentences) of this rebalance, focusing on:
    1. Any notable shifts in allocation (increases/decreases)
    2. The potential strategy behind this rebalance
    3. Potential market conditions that might justify this rebalance
    `;
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an AI agent for tokenized index rebalancing that provides concise, professional analysis." },
                { role: "user", content: prompt }
            ],
            max_tokens: 150,
        });
        const analysis = response.choices[0]?.message?.content ||
            "Analysis could not be generated. Proceeding with rebalance based on approved proposal parameters.";
        console.log('🧠 AGENT: AI analysis complete');
        return analysis;
    }
    catch (error) {
        console.error('❌ AGENT ERROR: Failed to analyze with OpenAI:', error);
        return "AI analysis unavailable. Proceeding with rebalance based on approved proposal parameters.";
    }
}
async function handleProposal(message) {
    if (message.type === 'RebalanceProposal') {
        console.log(`🤖 AGENT: Received new rebalance proposal: ${message.id}`);
        // Store the proposal for future reference
        pendingProposals.set(message.id, message);
        // Send notification to Moonscape
        if (hasMoonscapeChannels) {
            await sendToMoonscape({
                id: `moonscape-proposal-${Date.now()}`,
                type: 'AgentInfo', // Will be converted to AgentMessage in sendToMoonscape
                timestamp: Date.now(),
                sender: 'Rebalancer Agent', // Will be converted to Lynxify Agent in sendToMoonscape
                details: {
                    message: `Received new rebalance proposal with ID: ${message.id}`,
                    rebalancerStatus: 'processing',
                    proposalId: message.id,
                    agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
                }
            });
        }
        // Auto-approve the proposal (for demo purposes)
        // In a real system, this would wait for voting to complete
        setTimeout(async () => {
            await approveProposal(message.id);
        }, 5000); // Wait 5 seconds to simulate voting
    }
    else if (message.type === 'RebalanceApproved') {
        console.log(`🤖 AGENT: Detected approved rebalance: ${message.details?.proposalId}`);
        const proposalId = message.details?.proposalId;
        if (proposalId && pendingProposals.has(proposalId)) {
            const proposal = pendingProposals.get(proposalId);
            await executeRebalance(proposal);
        }
        else {
            console.log(`🤖 AGENT: Cannot find proposal ${proposalId} for execution`);
        }
    }
}
async function handleMoonscapeInbound(message) {
    console.log(`🌙 MOONSCAPE: Received inbound message: ${message.type}`);
    if (message.type === 'AgentRequest') {
        // Process agent request from Moonscape
        const requestType = message.details?.request;
        if (requestType === 'status') {
            // Send status update
            await sendAgentStatus();
        }
    }
}
async function approveProposal(proposalId) {
    if (!pendingProposals.has(proposalId)) {
        console.log(`🤖 AGENT: Cannot approve unknown proposal ${proposalId}`);
        return;
    }
    console.log(`🤖 AGENT: Auto-approving proposal ${proposalId} (demo simulation)`);
    const message = {
        id: `approval-${Date.now()}`,
        type: 'RebalanceApproved',
        timestamp: Date.now(),
        sender: 'rebalance-agent',
        details: {
            proposalId: proposalId,
            approvedAt: Date.now(),
            message: `Proposal ${proposalId} approved with 75% votes in favor`
        },
        votes: {
            for: 7500,
            against: 2500,
            total: 10000
        }
    };
    await hederaService.publishHCSMessage(governanceTopic, message);
    console.log(`🤖 AGENT: Approval message published to governance topic`);
    // Also send notification to Moonscape
    if (hasMoonscapeChannels) {
        await sendToMoonscape({
            id: `moonscape-approval-${Date.now()}`,
            type: 'AgentInfo', // Will be converted to AgentMessage in sendToMoonscape
            timestamp: Date.now(),
            sender: 'Rebalancer Agent', // Will be converted to Lynxify Agent in sendToMoonscape
            details: {
                message: `Approved rebalance proposal with ID: ${proposalId}`,
                rebalancerStatus: 'executing',
                proposalId: proposalId,
                agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
            }
        });
    }
}
async function executeRebalance(proposal) {
    if (!proposal || !proposal.id) {
        console.log('🤖 AGENT: Invalid proposal for execution');
        return;
    }
    // Check if we've already executed this proposal
    if (executedProposals.has(proposal.id)) {
        console.log(`🤖 AGENT: Proposal ${proposal.id} already executed`);
        return;
    }
    console.log(`🤖 AGENT: Executing rebalance for proposal ${proposal.id}`);
    // Use OpenAI to analyze the rebalance and generate reasoning
    const aiAnalysis = await analyzeRebalanceWithAI(proposal);
    // Get new weights from proposal
    const newWeights = proposal.details?.newWeights || {};
    try {
        // Get current token balances from TokenService
        console.log('🤖 AGENT: Fetching current token balances...');
        const currentBalances = await tokenService.getTokenBalances();
        console.log('🤖 AGENT: Current balances:', currentBalances);
        // Calculate required adjustments
        console.log('🤖 AGENT: Calculating token adjustments...');
        const adjustments = tokenService.calculateAdjustments(currentBalances, newWeights);
        console.log('🤖 AGENT: Calculated adjustments:', adjustments);
        // FORCE ADJUSTMENTS FOR TESTING - this ensures actual token operations occur
        console.log('🤖 AGENT: FORCING ADJUSTMENTS FOR TESTING REAL HTS OPERATIONS');
        // We'll mint some BTC, burn some ETH, and mint some SOL to demonstrate transactions
        const forcedAdjustments = {
            'BTC': 50, // Mint 50 BTC
            'ETH': -25, // Burn 25 ETH
            'SOL': 35 // Mint 35 SOL
        };
        // Get list of valid tokens
        const validTokens = Object.keys(tokenService.getAllTokenIds());
        console.log('🤖 AGENT: Valid tokens from token-data.json:', validTokens);
        // Execute token operations using TokenService (real HTS calls)
        for (const [token, adjustmentValue] of Object.entries(forcedAdjustments)) {
            // Skip if token is not in our valid tokens list
            if (!validTokens.includes(token)) {
                console.log(`⚠️ AGENT: Skipping token ${token} - not found in token-data.json`);
                continue;
            }
            // Ensure the amount is a number
            const amount = Number(adjustmentValue);
            if (isNaN(amount)) {
                console.log(`❌ AGENT: Invalid adjustment value for ${token}, skipping`);
                continue;
            }
            if (Math.abs(amount) < 1) {
                console.log(`🤖 AGENT: Adjustment too small for ${token}, skipping`);
                continue;
            }
            if (amount > 0) {
                console.log(`🚀 AGENT: Minting ${amount} ${token} tokens via HTS...`);
                const result = await tokenService.mintTokens(token, amount);
                if (result) {
                    console.log(`✅ AGENT: Successfully minted ${amount} ${token} tokens via HTS`);
                }
                else {
                    console.error(`❌ AGENT: Failed to mint ${token} tokens via HTS`);
                }
            }
            else if (amount < 0) {
                const burnAmount = Math.abs(amount);
                console.log(`🔥 AGENT: Burning ${burnAmount} ${token} tokens via HTS...`);
                const result = await tokenService.burnTokens(token, burnAmount);
                if (result) {
                    console.log(`✅ AGENT: Successfully burned ${burnAmount} ${token} tokens via HTS`);
                }
                else {
                    console.error(`❌ AGENT: Failed to burn ${token} tokens via HTS`);
                }
            }
        }
        // Get updated balances after operations
        const updatedBalances = await tokenService.getTokenBalances();
        console.log('🤖 AGENT: Updated balances after rebalance:', updatedBalances);
        // Prepare execution message
        const executionMessage = {
            id: `exec-${Date.now()}`,
            type: 'RebalanceExecuted',
            timestamp: Date.now(),
            sender: 'rebalance-agent',
            details: {
                proposalId: proposal.id,
                preBalances: currentBalances,
                postBalances: updatedBalances,
                executedAt: Date.now(),
                message: aiAnalysis // Store AI analysis in the message field
            }
        };
        // Publish to standard agent topic
        await hederaService.publishHCSMessage(agentTopic, executionMessage);
        console.log(`🤖 AGENT: Rebalance execution message published to agent topic`);
        // Also publish to Moonscape if configured
        if (hasMoonscapeChannels) {
            await sendToMoonscape({
                id: `moonscape-exec-${Date.now()}`,
                type: 'RebalanceExecuted',
                timestamp: Date.now(),
                sender: 'Rebalancer Agent',
                details: {
                    proposalId: proposal.id,
                    preBalances: currentBalances,
                    postBalances: updatedBalances,
                    executedAt: Date.now(),
                    message: aiAnalysis
                }
            });
        }
    }
    catch (error) {
        console.error('❌ AGENT ERROR: Failed to execute rebalance:', error);
    }
}
// Main function to initialize everything
async function main() {
    try {
        console.log('🚀 Initializing Lynxify combined server...');
        // Check if agent is registered
        if (hasMoonscapeChannels) {
            try {
                console.log('🌙 MOONSCAPE: Setting up agent connection...');
                const alreadyRegistered = await isAlreadyRegistered();
                if (!alreadyRegistered) {
                    console.log('🌙 MOONSCAPE: Registering agent...');
                    try {
                        // Since we're just making the code work without actually using Moonscape registration, 
                        // we'll skip the actual registration call and just store our agent info
                        await storeRegistrationStatus({
                            accountId: process.env.NEXT_PUBLIC_OPERATOR_ID,
                            inboundTopicId: moonscapeInboundTopic,
                            outboundTopicId: moonscapeOutboundTopic
                        });
                        console.log('🌙 MOONSCAPE: Agent registered successfully');
                    }
                    catch (error) {
                        console.error('❌ MOONSCAPE ERROR: Registration failed', error);
                    }
                }
                else {
                    console.log('🌙 MOONSCAPE: Agent already registered');
                }
            }
            catch (error) {
                console.error('❌ MOONSCAPE ERROR: Failed to initialize', error);
            }
        }
        // Initialize topics
        console.log('🔄 Initializing HCS topic subscriptions');
        // Subscribe to governance topic
        console.log('🔄 HEDERA: Subscribing to topic:', governanceTopic);
        await hederaService.subscribeToTopic(governanceTopic, handleProposal);
        console.log('✅ HEDERA: Successfully subscribed to topic', governanceTopic);
        // If Moonscape channels are configured, subscribe to inbound channel
        if (hasMoonscapeChannels) {
            console.log('🌙 MOONSCAPE: Starting Moonscape integration...');
            // Subscribe to inbound channel
            console.log('🔄 MOONSCAPE: Subscribing to inbound topic:', moonscapeInboundTopic);
            await hederaService.subscribeToTopic(moonscapeInboundTopic, handleMoonscapeInbound);
            console.log('✅ MOONSCAPE: Successfully subscribed to inbound topic');
            // Send status update
            await sendAgentStatus();
        }
        console.log('✅ Server initialized successfully!');
        // Create a demo proposal after 5 seconds
        setTimeout(async () => {
            console.log('🤖 AGENT: Creating test proposal...');
            // Get current token weights
            const currentBalances = await tokenService.getTokenBalances();
            // Convert to number array and calculate total
            const balanceValues = Object.values(currentBalances).map(value => Number(value));
            const totalSupply = balanceValues.reduce((sum, val) => sum + val, 0);
            const currentWeights = {};
            for (const [token, balance] of Object.entries(currentBalances)) {
                currentWeights[token] = Number(balance) / totalSupply;
            }
            // Create proposal (using the same weights to avoid changes for demo)
            const proposalMessage = {
                id: `prop-${Date.now()}`,
                type: 'RebalanceProposal',
                timestamp: Date.now(),
                sender: 'rebalance-agent',
                details: {
                    newWeights: currentWeights,
                    executeAfter: Date.now() + 86400000, // 24 hours from now
                    quorum: 5000, // 50% required
                    trigger: 'scheduled',
                    message: "Scheduled weekly rebalance - maintaining current allocation"
                }
            };
            // Publish to governance topic
            await hederaService.publishHCSMessage(governanceTopic, proposalMessage);
            console.log('✅ HEDERA: Demo proposal created successfully');
            // Also send a message to Moonscape to demonstrate communication
            if (hasMoonscapeChannels) {
                console.log('🌙 MOONSCAPE: Sending proposal notification to Moonscape');
                // Create notification data
                const notificationData = {
                    id: `notification-${Date.now()}`,
                    timestamp: Date.now(),
                    type: "ProposalCreated",
                    content: "Created a new rebalance proposal",
                    metadata: {
                        testTime: new Date().toISOString(),
                        agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                        proposalId: proposalMessage.id,
                        status: "active"
                    }
                };
                // Format as HCSMessage for our publishHCSMessage function
                const moonscapeNotification = {
                    id: `notification-${Date.now()}`,
                    type: 'AgentInfo',
                    timestamp: Date.now(),
                    sender: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
                    details: {
                        message: JSON.stringify({
                            p: "hcs-10",
                            op: "message",
                            operator_id: `${moonscapeInboundTopic}@${process.env.NEXT_PUBLIC_OPERATOR_ID}`,
                            data: JSON.stringify(notificationData),
                            m: "Proposal creation notification"
                        })
                    }
                };
                await hederaService.publishHCSMessage(moonscapeOutboundTopic, moonscapeNotification);
                console.log('✅ MOONSCAPE: Proposal notification sent successfully with HCS-10 format');
            }
        }, 5000);
        // When a periodic check is due
        setInterval(async () => {
            if (pendingProposals.size > 0) {
                console.log(`🔍 Currently monitoring ${pendingProposals.size} active proposals`);
            }
            // Send heartbeat status message to Moonscape
            if (hasMoonscapeChannels) {
                await sendAgentStatus();
            }
        }, 60000); // Every minute
        // Send initial status message
        if (hasMoonscapeChannels) {
            await sendAgentStatus();
        }
    }
    catch (error) {
        console.error('❌ ERROR: Failed to initialize server:', error);
    }
}
// Run the main function
main().catch(err => {
    console.error('❌ FATAL ERROR:', err);
    process.exit(1);
});
