"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config({ path: '.env.local' });
process.env.BYPASS_TOPIC_CHECK = 'true';
const hedera_1 = require("../services/hedera");
const openai_1 = __importDefault(require("openai"));
// Initialize OpenAI
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Message types from spec
const MESSAGE_TYPES = {
    REBALANCE_PROPOSAL: 'RebalanceProposal',
    REBALANCE_APPROVED: 'RebalanceApproved',
    REBALANCE_EXECUTED: 'RebalanceExecuted',
};
// Initialize Hedera service
const hederaService = new hedera_1.HederaService();
console.log('🤖 AGENT: Rebalance agent starting...');
// Get topic IDs from environment
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '';
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || '';
console.log('🤖 AGENT: Using topics:', {
    governanceTopic,
    agentTopic,
});
if (!governanceTopic || !agentTopic) {
    console.error('❌ AGENT ERROR: Missing required topic IDs');
    process.exit(1);
}
// Store pending proposals
const pendingProposals = new Map();
const executedProposals = new Set();
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
    if (message.type === MESSAGE_TYPES.REBALANCE_PROPOSAL) {
        console.log(`🤖 AGENT: Received new rebalance proposal: ${message.id}`);
        // Store the proposal for future reference
        pendingProposals.set(message.id, message);
        // Auto-approve the proposal (for demo purposes)
        // In a real system, this would wait for voting to complete
        setTimeout(async () => {
            await approveProposal(message.id);
        }, 5000); // Wait 5 seconds to simulate voting
    }
    else if (message.type === MESSAGE_TYPES.REBALANCE_APPROVED) {
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
    // Simulate execution (in a real system, this would call smart contracts)
    const newWeights = proposal.details?.newWeights || {};
    // Track pre-balances (simulated)
    const preBalances = {};
    Object.keys(newWeights).forEach(token => {
        // Simulate previous random allocation around 0-10000 tokens
        preBalances[token] = Math.floor(Math.random() * 10000);
    });
    // Publish execution message to agent topic
    const message = {
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
// Main function to start the agent
async function startAgent() {
    try {
        console.log('🤖 AGENT: Subscribing to governance topic');
        await hederaService.subscribeToTopic(governanceTopic, handleProposal);
        console.log('🤖 AGENT: Ready to process rebalance proposals');
        console.log('🤖 AGENT: Submit a proposal from the UI to see the agent in action');
    }
    catch (error) {
        console.error('❌ AGENT ERROR: Failed to start rebalance agent:', error);
        process.exit(1);
    }
}
// Start the agent
startAgent().catch(err => {
    console.error('❌ AGENT ERROR: Unhandled error:', err);
    process.exit(1);
});
