// Load environment variables from .env.local first
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Then load environment config
import './src/app/config/env';

// Import WebSocket server components
import type { WebSocket } from 'ws';
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const { HederaService } = require('./src/app/services/hedera');
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
console.log('==========================================');

// Set environment variables for development
process.env.BYPASS_TOPIC_CHECK = 'true';

// Use variables from .env.local - don't override if already set
// If we're running this for the demo, these topic IDs should be in .env.local

// Initialize services
const hederaService = new HederaService();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get topic IDs
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '';
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '';

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
    if (client.readyState === ws.OPEN) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error('❌ Error sending WebSocket message:', err);
      }
    }
  });
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
  
  // Simulate execution (in a real system, this would call smart contracts)
  const newWeights = proposal.details?.newWeights as TokenWeights || {};
  
  // Track pre-balances (simulated)
  const preBalances: Record<string, number> = {};
  Object.keys(newWeights).forEach(token => {
    // Simulate previous random allocation around 0-10000 tokens
    preBalances[token] = Math.floor(Math.random() * 10000);
  });
  
  // Publish execution message to agent topic
  const message: HCSMessage = {
    id: `exec-${Date.now()}`,
    type: 'RebalanceExecuted',
    timestamp: Date.now(),
    sender: 'rebalance-agent',
    details: {
      proposalId: proposal.id,
      preBalances: preBalances,
      postBalances: newWeights,
      executedAt: Date.now(),
      message: aiAnalysis // Store AI analysis in the message field
    }
  };
  
  await hederaService.publishHCSMessage(agentTopic, message);
  console.log(`🤖 AGENT: Rebalance execution message published to agent topic`);
  
  // Mark as executed
  executedProposals.add(proposal.id);
  console.log(`🤖 AGENT: Rebalance for proposal ${proposal.id} completed successfully`);
}

// === MAIN FUNCTIONS ===

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
    agentTopic: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC
  });
  
  // Start WebSocket server
  console.log('WebSocket server starting on port 3001...');
  await subscribeToTopicsWS();
  
  // Start agent
  console.log('Starting rebalance agent...');
  await startAgent();
  
  console.log('✅ Combined server started successfully!');
  console.log('📋 READY FOR DEMO: Submit a proposal from the UI to see automated rebalancing in action');
}

// Start the server
startCombinedServer().catch(err => {
  console.error('❌ ERROR: Unhandled error:', err);
  process.exit(1);
}); 