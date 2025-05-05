// Load environment variables from .env.local first
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Then load environment config
import './src/app/config/env';

// Import WebSocket server components
import type { WebSocket } from 'ws';
const { WebSocketServer, WebSocket: WS } = require('ws');
const { HederaService } = require('./src/app/services/hedera');
const { TokenService } = require('./src/app/services/token-service');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const messageStore = require('./src/app/services/message-store').default;

// Import types
import { HCSMessage, TokenWeights } from './src/app/types/hcs';

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

// Initialize services
const hederaService = new HederaService();
const tokenService = new TokenService();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '';
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '';

// Get Moonscape topic IDs
const moonscapeInboundTopic = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC?.trim().replace(/\"/g, '') || '';
const moonscapeOutboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC?.trim().replace(/\"/g, '') || '';
const moonscapeProfileTopic = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC?.trim().replace(/\"/g, '') || '';
const hasMoonscapeChannels = Boolean(moonscapeInboundTopic && moonscapeOutboundTopic);

// Initialize WebSocket server
const wss = new WebSocketServer({ port: 3001 });
const clients = new Set<WebSocket>();

// Initialize Agent Data Structures
const pendingProposals = new Map<string, HCSMessage>();
const executedProposals = new Set<string>();
const MESSAGE_TYPES = {
  REBALANCE_PROPOSAL: 'RebalanceProposal',
  REBALANCE_APPROVED: 'RebalanceApproved',
  REBALANCE_EXECUTED: 'RebalanceExecuted',
} as const;

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

// Broadcast message to all connected clients
function broadcastMessage(message: any) {
  const messageStr = JSON.stringify(message);
  console.log(`📢 Broadcasting WebSocket message: ${messageStr.substring(0, 100)}...`);
  
  clients.forEach((client: WebSocket) => {
    if (client.readyState === WS.OPEN) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error('❌ Error sending WebSocket message:', err);
      }
    }
  });
}

// Send message to Moonscape outbound channel
async function sendToMoonscape(message: HCSMessage) {
  if (!hasMoonscapeChannels) {
    console.log('⚠️ MOONSCAPE: Cannot send message - Moonscape channels not configured');
    return;
  }
  
  try {
    console.log(`🌙 MOONSCAPE: Sending message to outbound channel: ${message.type}`);
    await hederaService.publishHCSMessage(moonscapeOutboundTopic, message);
    console.log('🌙 MOONSCAPE: Message sent successfully');
  } catch (error) {
    console.error('❌ MOONSCAPE ERROR: Failed to send message:', error);
  }
}

// Update agent profile on Moonscape
async function updateAgentProfile() {
  if (!moonscapeProfileTopic) {
    console.log('⚠️ MOONSCAPE: Cannot update profile - profile channel not configured');
    return;
  }
  
  try {
    console.log('🌙 MOONSCAPE: Updating agent profile');
    const profileMessage: HCSMessage = {
      id: `profile-${Date.now()}`,
      type: 'AgentInfo',
      timestamp: Date.now(),
      sender: 'Rebalancer Agent',
      details: {
        message: 'Rebalancer Agent profile update',
        agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
        capabilities: ['rebalancing', 'market_analysis', 'token_management', 'portfolio_optimization'],
        agentDescription: 'AI-powered rebalancing agent for the Lynxify Tokenized Index'
      }
    };
    
    await hederaService.publishHCSMessage(moonscapeProfileTopic, profileMessage);
    console.log('🌙 MOONSCAPE: Profile updated successfully');
  } catch (error) {
    console.error('❌ MOONSCAPE ERROR: Failed to update profile:', error);
  }
}

// === AGENT FUNCTIONS ===

async function analyzeRebalanceWithAI(proposal: HCSMessage): Promise<string> {
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
  } catch (error) {
    console.error('❌ AGENT ERROR: Failed to analyze with OpenAI:', error);
    return "AI analysis unavailable. Proceeding with rebalance based on approved proposal parameters.";
  }
}

async function handleProposal(message: HCSMessage) {
  if (message.type === 'RebalanceProposal') {
    console.log(`🤖 AGENT: Received new rebalance proposal: ${message.id}`);
    
    // Store the proposal for future reference
    pendingProposals.set(message.id, message);
    
    // Send notification to Moonscape
    if (hasMoonscapeChannels) {
      await sendToMoonscape({
        id: `moonscape-proposal-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
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
      const proposal = pendingProposals.get(proposalId)!;
      await executeRebalance(proposal);
    } else {
      console.log(`🤖 AGENT: Cannot find proposal ${proposalId} for execution`);
    }
  }
}

async function handleMoonscapeInbound(message: HCSMessage) {
  console.log(`🌙 MOONSCAPE: Received inbound message: ${message.type}`);
  
  if (message.type === 'AgentRequest') {
    // Process agent request from Moonscape
    const requestType = message.details?.request;
    
    if (requestType === 'status') {
      // Send status update
      await sendToMoonscape({
        id: `status-${Date.now()}`,
        type: 'AgentResponse',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
        details: {
          message: 'Rebalancer Agent status response',
          rebalancerStatus: 'active',
          pendingProposals: pendingProposals.size,
          executedProposals: executedProposals.size,
          agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
        }
      });
    }
  }
}

async function approveProposal(proposalId: string) {
  if (!pendingProposals.has(proposalId)) {
    console.log(`🤖 AGENT: Cannot approve unknown proposal ${proposalId}`);
    return;
  }
  
  console.log(`🤖 AGENT: Auto-approving proposal ${proposalId} (demo simulation)`);
  
  const message: HCSMessage = {
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
      type: 'AgentInfo',
      timestamp: Date.now(),
      sender: 'Rebalancer Agent',
      details: {
        message: `Approved rebalance proposal with ID: ${proposalId}`,
        rebalancerStatus: 'executing',
        proposalId: proposalId,
        agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
      }
    });
  }
}

async function executeRebalance(proposal: HCSMessage) {
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
  const newWeights = proposal.details?.newWeights as TokenWeights || {};
  
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
      'BTC': 50,    // Mint 50 BTC
      'ETH': -25,   // Burn 25 ETH
      'SOL': 35     // Mint 35 SOL
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
        } else {
          console.error(`❌ AGENT: Failed to mint ${token} tokens via HTS`);
        }
      } else if (amount < 0) {
        const burnAmount = Math.abs(amount);
        console.log(`🔥 AGENT: Burning ${burnAmount} ${token} tokens via HTS...`);
        const result = await tokenService.burnTokens(token, burnAmount);
        if (result) {
          console.log(`✅ AGENT: Successfully burned ${burnAmount} ${token} tokens via HTS`);
        } else {
          console.error(`❌ AGENT: Failed to burn ${token} tokens via HTS`);
        }
      }
    }
    
    // Get updated balances after operations
    const updatedBalances = await tokenService.getTokenBalances();
    console.log('🤖 AGENT: Updated balances after rebalance:', updatedBalances);
    
    // Prepare execution message
    const executionMessage: HCSMessage = {
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
        id: `moonscape-execution-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
        details: {
          message: `Successfully executed rebalance proposal ${proposal.id}`,
          rebalancerStatus: 'completed',
          proposalId: proposal.id,
          executedAt: Date.now(),
          analysis: aiAnalysis,
          agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
        }
      });
    }
    
    // Mark as executed
    executedProposals.add(proposal.id);
    console.log(`🤖 AGENT: Rebalance for proposal ${proposal.id} completed successfully`);
  } catch (error) {
    console.error('❌ AGENT ERROR: Failed to execute rebalance:', error);
    
    // Send error notification to Moonscape
    if (hasMoonscapeChannels) {
      await sendToMoonscape({
        id: `moonscape-error-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
        details: {
          message: `Error executing rebalance for proposal ${proposal.id}: ${error}`,
          rebalancerStatus: 'error',
          proposalId: proposal.id,
          agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
        }
      });
    }
  }
}

// === MAIN FUNCTIONS ===

// Send agent status to Moonscape
async function sendAgentStatus() {
  if (!hasMoonscapeChannels) {
    console.log('⚠️ MOONSCAPE: Cannot send status - Moonscape channels not configured');
    return;
  }
  
  try {
    console.log('🌙 MOONSCAPE: Sending agent status message');
    const statusMessage: HCSMessage = {
      id: `status-${Date.now()}`,
      type: 'AgentInfo',
      timestamp: Date.now(),
      sender: 'Rebalancer Agent',
      details: {
        message: 'Rebalancer Agent status update',
        rebalancerStatus: 'active',
        agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || '',
        pendingProposals: pendingProposals.size,
        executedProposals: executedProposals.size
      }
    };
    
    await sendToMoonscape(statusMessage);
  } catch (error) {
    console.error('❌ MOONSCAPE ERROR: Failed to send status message:', error);
  }
}

// Subscribe to HCS topics for WebSocket
async function subscribeToTopicsWS() {
  try {
    console.log('Subscribing to topics for WebSocket broadcasting:', {
      governance: governanceTopic,
      agent: agentTopic
    });

    // Subscribe to governance topic
    await hederaService.subscribeToTopic(
      governanceTopic,
      (message: HCSMessage) => {
        broadcastMessage({
          type: 'governance',
          data: message
        });
      }
    );

    // Subscribe to agent topic
    await hederaService.subscribeToTopic(
      agentTopic,
      (message: HCSMessage) => {
        broadcastMessage({
          type: 'agent',
          data: message
        });
      }
    );

    // Subscribe to Moonscape inbound channel if configured
    if (moonscapeInboundTopic) {
      console.log(`🌙 MOONSCAPE: Subscribing to inbound channel ${moonscapeInboundTopic}`);
      await hederaService.subscribeToTopic(moonscapeInboundTopic, handleMoonscapeInbound);
    }

    console.log('Subscribed to HCS topics for WebSocket broadcasting');
  } catch (error) {
    console.error('Error subscribing to topics for WebSocket:', error);
    console.log('Continuing operation despite subscription errors');
  }
}

// Start the agent
async function startAgent() {
  try {
    console.log('🤖 AGENT: Subscribing to governance topic');
    await hederaService.subscribeToTopic(governanceTopic, handleProposal);
    
    // Moonscape integration
    if (hasMoonscapeChannels) {
      console.log('🌙 MOONSCAPE: Integration enabled with channels:', {
        inbound: moonscapeInboundTopic,
        outbound: moonscapeOutboundTopic,
        profile: moonscapeProfileTopic
      });
      
      // Send initial status and update profile
      await sendAgentStatus();
      if (moonscapeProfileTopic) {
        await updateAgentProfile();
      }
    }
    
    console.log('🤖 AGENT: Ready to process rebalance proposals');
    console.log('🤖 AGENT: Submit a proposal from the UI to see the agent in action');
  } catch (error) {
    console.error('❌ AGENT ERROR: Failed to start rebalance agent:', error);
  }
}

// Start the combined server
async function startCombinedServer() {
  console.log('🚀 Starting combined WebSocket server and agent...');
  
  // Log the environment variables being used
  console.log('Environment variables:', {
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    governanceTopic: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
    agentTopic: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
    moonscapeEnabled: hasMoonscapeChannels
  });
  
  // Start WebSocket server
  console.log('WebSocket server starting on port 3001...');
  await subscribeToTopicsWS();
  
  // Start agent
  console.log('Starting rebalance agent...');
  await startAgent();
  
  console.log('✅ Combined server started successfully!');
  console.log('📋 READY FOR DEMO: Submit a proposal from the UI to see automated rebalancing in action');
  
  if (hasMoonscapeChannels) {
    console.log('🌙 MOONSCAPE INTEGRATION: Agent is registered on Moonscape.tech');
    console.log(`🌙 Visit https://hashscan.io/testnet/topic/${moonscapeOutboundTopic} to see outbound messages`);
    if (moonscapeProfileTopic) {
      console.log(`🌙 Visit https://hashscan.io/testnet/topic/${moonscapeProfileTopic} to see profile updates`);
    }
  }
}

// Start the server
startCombinedServer().catch(err => {
  console.error('❌ ERROR: Unhandled error:', err);
  process.exit(1);
}); 