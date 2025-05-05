require('dotenv').config({ path: '.env.local' });
process.env.BYPASS_TOPIC_CHECK = 'true';

import { HederaService } from '../services/hedera';
import { TokenService } from '../services/token-service';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { HCSMessage, TokenWeights } from '../types/hcs';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Message types from spec
const MESSAGE_TYPES = {
  REBALANCE_PROPOSAL: 'RebalanceProposal',
  REBALANCE_APPROVED: 'RebalanceApproved',
  REBALANCE_EXECUTED: 'RebalanceExecuted',
  AGENT_INFO: 'AgentInfo',
  AGENT_RESPONSE: 'AgentResponse',
  AGENT_REQUEST: 'AgentRequest',
} as const;

// Initialize Hedera service
const hederaService = new HederaService();
const tokenService = new TokenService(); // Initialize TokenService for HTS operations
console.log('🤖 AGENT: Rebalance agent starting...');

// Get topic IDs from environment
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '';
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '';

// Get Moonscape topics
const moonscapeInboundTopic = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '';
const moonscapeOutboundTopic = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '';
const moonscapeProfileTopic = process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC || '';

// Log topics being used
console.log('🤖 AGENT: Using standard topics:', {
  governanceTopic,
  agentTopic,
});

console.log('🌙 AGENT: Using Moonscape channels:', {
  inbound: moonscapeInboundTopic,
  outbound: moonscapeOutboundTopic,
  profile: moonscapeProfileTopic
});

if (!governanceTopic || !agentTopic) {
  console.error('❌ AGENT ERROR: Missing required topic IDs');
  process.exit(1);
}

const hasMoonscapeChannels = !!(moonscapeInboundTopic && moonscapeOutboundTopic);
if (hasMoonscapeChannels) {
  console.log('🌙 AGENT: Moonscape integration enabled');
} else {
  console.log('⚠️ AGENT: Moonscape integration disabled (missing channel IDs)');
}

// Store pending proposals
const pendingProposals = new Map<string, HCSMessage>();
const executedProposals = new Set<string>();

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
  if (message.type === MESSAGE_TYPES.REBALANCE_PROPOSAL) {
    console.log(`🤖 AGENT: Received new rebalance proposal: ${message.id}`);
    
    // Store the proposal for future reference
    pendingProposals.set(message.id, message);
    
    // Auto-approve the proposal (for demo purposes)
    // In a real system, this would wait for voting to complete
    setTimeout(async () => {
      await approveProposal(message.id);
    }, 5000); // Wait 5 seconds to simulate voting
    
    // Send notification to Moonscape outbound channel
    if (hasMoonscapeChannels) {
      await sendToMoonscape({
        id: `moonscape-notification-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
        details: {
          message: `Received rebalance proposal with ID: ${message.id}`,
          rebalancerStatus: 'processing',
          agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
        }
      });
    }
  } 
  else if (message.type === MESSAGE_TYPES.REBALANCE_APPROVED) {
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
  console.log(`🌙 AGENT: Received message from Moonscape inbound channel: ${message.type}`);
  
  // Generate a response for Moonscape
  const response: HCSMessage = {
    id: `moonscape-response-${Date.now()}`,
    type: 'AgentResponse',
    timestamp: Date.now(),
    sender: 'Rebalancer Agent',
    details: {
      message: `This is a response from the Rebalancer Agent to your message of type: ${message.type}`,
      originalMessageId: message.id,
      rebalancerStatus: 'active',
      agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
    }
  };
  
  // Send response to Moonscape outbound channel
  await sendToMoonscape(response);
  
  // If it's a specific request, handle it
  if (message.type === 'AgentRequest' && message.details?.request) {
    if (message.details.request.toLowerCase().includes('status')) {
      await sendAgentStatus();
    } else if (message.details.request.toLowerCase().includes('rebalance')) {
      // Trigger a rebalance for demonstration
      await createDemoRebalanceProposal();
    }
  }
}

async function sendToMoonscape(message: HCSMessage) {
  if (!moonscapeOutboundTopic) {
    console.log('⚠️ AGENT: Cannot send to Moonscape - outbound channel not configured');
    return;
  }
  
  try {
    console.log(`🌙 AGENT: Sending message to Moonscape outbound channel: ${message.type}`);
    await hederaService.publishHCSMessage(moonscapeOutboundTopic, message);
    console.log('🌙 AGENT: Message sent successfully to Moonscape');
  } catch (error) {
    console.error('❌ AGENT: Failed to send message to Moonscape:', error);
  }
}

async function sendAgentStatus() {
  if (!moonscapeOutboundTopic) {
    return;
  }
  
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
}

async function updateAgentProfile() {
  if (!moonscapeProfileTopic) {
    console.log('⚠️ AGENT: Cannot update profile - profile channel not configured');
    return;
  }
  
  try {
    console.log('🌙 AGENT: Updating agent profile on Moonscape');
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
    console.log('🌙 AGENT: Profile updated successfully on Moonscape');
  } catch (error) {
    console.error('❌ AGENT: Failed to update profile on Moonscape:', error);
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
      // Add custom details that don't conflict with type definition
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
    
    // Execute token operations using TokenService (real HTS calls)
    for (const [token, amount] of Object.entries(adjustments)) {
      if (Math.abs(amount) < 1) {
        console.log(`🤖 AGENT: Adjustment too small for ${token}, skipping`);
        continue;
      }
      
      if (amount > 0) {
        console.log(`🤖 AGENT: Minting ${amount} ${token} tokens...`);
        const result = await tokenService.mintTokens(token, amount);
        if (result) {
          console.log(`🤖 AGENT: Successfully minted ${amount} ${token} tokens`);
        } else {
          console.error(`🤖 AGENT: Failed to mint ${token} tokens`);
        }
      } else if (amount < 0) {
        const burnAmount = Math.abs(amount);
        console.log(`🤖 AGENT: Burning ${burnAmount} ${token} tokens...`);
        const result = await tokenService.burnTokens(token, burnAmount);
        if (result) {
          console.log(`🤖 AGENT: Successfully burned ${burnAmount} ${token} tokens`);
        } else {
          console.error(`🤖 AGENT: Failed to burn ${token} tokens`);
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
    console.error('🤖 AGENT ERROR: Failed to execute rebalance:', error);
    
    // Send error notification to Moonscape
    if (hasMoonscapeChannels) {
      await sendToMoonscape({
        id: `moonscape-error-${Date.now()}`,
        type: 'AgentInfo',
        timestamp: Date.now(),
        sender: 'Rebalancer Agent',
        details: {
          message: `Error executing rebalance proposal ${proposal.id}: ${error}`,
          rebalancerStatus: 'error',
          proposalId: proposal.id,
          agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
        }
      });
    }
  }
}

async function createDemoRebalanceProposal() {
  console.log('🤖 AGENT: Creating a demo rebalance proposal');
  
  const weights = {
    'BTC': 0.4,
    'ETH': 0.3,
    'SOL': 0.2,
    'HBAR': 0.1
  };
  
  const proposal: HCSMessage = {
    id: `demo-prop-${Date.now()}`,
    type: 'RebalanceProposal',
    timestamp: Date.now(),
    sender: 'rebalance-agent',
    details: {
      newWeights: weights,
      executeAfter: Date.now() + 86400000, // 24 hours from now
      quorum: 5000,
      message: 'Demo rebalance proposal created in response to Moonscape request'
    }
  };
  
  await hederaService.publishHCSMessage(governanceTopic, proposal);
  
  // Also notify on Moonscape
  if (hasMoonscapeChannels) {
    await sendToMoonscape({
      id: `moonscape-demo-${Date.now()}`,
      type: 'AgentResponse',
      timestamp: Date.now(),
      sender: 'Rebalancer Agent',
      details: {
        message: `Created demo rebalance proposal with ID: ${proposal.id}`,
        rebalancerStatus: 'processing',
        proposalId: proposal.id,
        agentId: process.env.NEXT_PUBLIC_OPERATOR_ID || ''
      }
    });
  }
  
  // Store for later execution
  pendingProposals.set(proposal.id, proposal);
  
  // Auto-approve after delay
  setTimeout(async () => {
    await approveProposal(proposal.id);
  }, 5000);
}

// Main function to start the agent
async function startAgent() {
  try {
    console.log('🤖 AGENT: Subscribing to governance topic');
    await hederaService.subscribeToTopic(governanceTopic, handleProposal);
    
    // If Moonscape channels are configured, subscribe to the inbound channel
    if (hasMoonscapeChannels && moonscapeInboundTopic) {
      console.log('🌙 AGENT: Subscribing to Moonscape inbound channel');
      await hederaService.subscribeToTopic(moonscapeInboundTopic, handleMoonscapeInbound);
      
      // Send initial status to Moonscape
      await sendAgentStatus();
      
      // Update profile
      if (moonscapeProfileTopic) {
        await updateAgentProfile();
      }
    }
    
    console.log('🤖 AGENT: Ready to process rebalance proposals');
    console.log('🤖 AGENT: Submit a proposal from the UI to see the agent in action');
    
    // Send status updates to Moonscape periodically
    if (hasMoonscapeChannels) {
      setInterval(async () => {
        await sendAgentStatus();
      }, 300000); // Every 5 minutes
    }
  } catch (error) {
    console.error('❌ AGENT ERROR: Failed to start rebalance agent:', error);
    process.exit(1);
  }
}

// Start the agent
startAgent().catch(err => {
  console.error('❌ AGENT ERROR: Unhandled error:', err);
  process.exit(1);
}); 