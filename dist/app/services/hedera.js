"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hederaService = exports.HederaService = void 0;
const sdk_1 = require("@hashgraph/sdk");
const hcs_1 = require("../types/hcs");
// HCS Topic IDs from the spec
const TOPICS = {
    GOVERNANCE_PROPOSALS: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '',
    MARKET_PRICE_FEED: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC || '',
    AGENT_ACTIONS: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || ''
};
// Validate environment variables unless bypassed (for initialization)
if (process.env.BYPASS_TOPIC_CHECK !== 'true') {
    Object.entries(TOPICS).forEach(([key, value]) => {
        if (!value) {
            throw new Error(`Missing required environment variable for ${key} topic`);
        }
    });
}
// Type-safe topic IDs after validation
const TOPIC_IDS = {
    GOVERNANCE_PROPOSALS: TOPICS.GOVERNANCE_PROPOSALS,
    MARKET_PRICE_FEED: TOPICS.MARKET_PRICE_FEED,
    AGENT_ACTIONS: TOPICS.AGENT_ACTIONS
};
// Agent configuration from the spec
const AGENTS = {
    PRICE_FEED: {
        id: 'price-feed-agent',
        description: 'Monitors token prices and detects deviations',
        threshold: 0.05 // 5% deviation threshold
    },
    RISK_ASSESSMENT: {
        id: 'risk-assessment-agent',
        description: 'Analyzes market conditions and triggers alerts',
        riskLevels: {
            low: 0.05,
            medium: 0.10,
            high: 0.15
        }
    },
    REBALANCE: {
        id: 'rebalance-agent',
        description: 'Executes approved rebalance proposals'
    }
};
class HederaService {
    constructor() {
        this.subscriptions = new Map();
        this.lastPrices = new Map();
        this.messageHandlers = new Map();
        // Message handlers
        this.handlePriceFeedMessage = async (message) => {
            if (message.type === 'PriceUpdate') {
                // Store the last price for calculating changes
                this.lastPrices.set(message.tokenId, message.price);
                console.log('Price update received:', message);
            }
        };
        this.handleGovernanceMessage = async (message) => {
            if (message.type === 'RebalanceProposal') {
                // Handle rebalance proposal
                console.log('Rebalance proposal received:', message);
            }
            else if (message.type === 'RebalanceApproved') {
                // Handle approved proposal
                console.log('Rebalance approved:', message);
            }
        };
        this.handleAgentMessage = async (message) => {
            if (message.type === 'RebalanceExecuted') {
                // Handle rebalance execution
                console.log('Rebalance executed:', message);
            }
        };
        // Initialize Hedera client with your testnet credentials
        this.client = sdk_1.Client.forTestnet();
        this.client.setOperator(sdk_1.AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID || ''), sdk_1.PrivateKey.fromString(process.env.OPERATOR_KEY || ''));
    }
    // Create HCS topics
    async createGovernanceTopic() {
        try {
            const transaction = new sdk_1.TopicCreateTransaction()
                .setTopicMemo('Governance Proposals Topic');
            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            if (!receipt.topicId) {
                throw new Error('Failed to create governance topic');
            }
            return receipt.topicId.toString();
        }
        catch (error) {
            console.error('Error creating governance topic:', error);
            throw error;
        }
    }
    async createAgentTopic() {
        try {
            const transaction = new sdk_1.TopicCreateTransaction()
                .setTopicMemo('Agent Actions Topic');
            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            if (!receipt.topicId) {
                throw new Error('Failed to create agent topic');
            }
            return receipt.topicId.toString();
        }
        catch (error) {
            console.error('Error creating agent topic:', error);
            throw error;
        }
    }
    async createPriceFeedTopic() {
        try {
            const transaction = new sdk_1.TopicCreateTransaction()
                .setTopicMemo('Price Feed Topic');
            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            if (!receipt.topicId) {
                throw new Error('Failed to create price feed topic');
            }
            return receipt.topicId.toString();
        }
        catch (error) {
            console.error('Error creating price feed topic:', error);
            throw error;
        }
    }
    // Get messages from a topic
    async getTopicMessages(topicId) {
        try {
            const query = new sdk_1.TopicMessageQuery()
                .setTopicId(sdk_1.TopicId.fromString(topicId));
            const messages = [];
            await new Promise((resolve, reject) => {
                query.subscribe(this.client, 
                // First callback is for handling errors, but it receives both message and error
                (message, error) => {
                    reject(error);
                }, 
                // Second callback is for handling messages
                (message) => {
                    try {
                        const parsedMessage = JSON.parse(new TextDecoder().decode(message.contents));
                        if ((0, hcs_1.isValidHCSMessage)(parsedMessage)) {
                            messages.push(parsedMessage);
                        }
                    }
                    catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });
                // Resolve after a short delay to allow messages to be received
                setTimeout(resolve, 1000);
            });
            return messages;
        }
        catch (error) {
            console.error('Error getting topic messages:', error);
            throw error;
        }
    }
    // HCS Message Publishing
    async publishHCSMessage(topicId, message) {
        try {
            const transaction = new sdk_1.TopicMessageSubmitTransaction()
                .setTopicId(sdk_1.TopicId.fromString(topicId))
                .setMessage(JSON.stringify(message));
            await transaction.execute(this.client);
        }
        catch (error) {
            console.error('Error publishing HCS message:', error);
            throw error;
        }
    }
    // HCS Message Subscription
    async subscribeToTopic(topicId, onMessage) {
        // Add message handler
        if (!this.messageHandlers.has(topicId)) {
            this.messageHandlers.set(topicId, []);
        }
        this.messageHandlers.get(topicId)?.push(onMessage);
        // If we already have a subscription, don't create another one
        if (this.subscriptions.has(topicId)) {
            return;
        }
        const query = new sdk_1.TopicMessageQuery()
            .setTopicId(sdk_1.TopicId.fromString(topicId));
        const subscription = query.subscribe(this.client, 
        // First callback is for handling errors, but it receives both message and error
        (message, error) => {
            console.error('Error in topic subscription:', error);
        }, 
        // Second callback is for handling messages
        (message) => {
            try {
                const parsedMessage = JSON.parse(new TextDecoder().decode(message.contents));
                if ((0, hcs_1.isValidHCSMessage)(parsedMessage)) {
                    // Notify all handlers for this topic
                    this.messageHandlers.get(topicId)?.forEach(handler => {
                        handler(parsedMessage);
                    });
                }
                else {
                    console.error('Invalid HCS message format:', parsedMessage);
                }
            }
            catch (error) {
                console.error('Error parsing HCS message:', error);
            }
        });
        this.subscriptions.set(topicId, subscription);
    }
    // Unsubscribe from topic
    async unsubscribeFromTopic(topicId) {
        const subscription = this.subscriptions.get(topicId);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(topicId);
            this.messageHandlers.delete(topicId);
        }
    }
    // Initialize HCS topics
    async initializeTopics() {
        // Subscribe to all topics
        await this.subscribeToTopic(TOPICS.MARKET_PRICE_FEED, this.handlePriceFeedMessage.bind(this));
        await this.subscribeToTopic(TOPICS.GOVERNANCE_PROPOSALS, this.handleGovernanceMessage.bind(this));
        await this.subscribeToTopic(TOPICS.AGENT_ACTIONS, this.handleAgentMessage.bind(this));
    }
    // Agent Functions
    async processPriceUpdate(price, tokenId) {
        const message = {
            type: 'PriceUpdate',
            timestamp: Date.now(),
            tokenId,
            price,
            sender: AGENTS.PRICE_FEED.id,
            source: 'price-feed-agent'
        };
        await this.publishHCSMessage(TOPICS.MARKET_PRICE_FEED, message);
    }
    async assessRisk(priceChange, tokenId) {
        const riskLevel = Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.high ? 'high' :
            Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.medium ? 'medium' :
                'low';
        const message = {
            type: 'RiskAlert',
            timestamp: Date.now(),
            sender: AGENTS.RISK_ASSESSMENT.id,
            severity: riskLevel,
            description: `Price deviation of ${priceChange}% detected for ${tokenId}`,
            affectedTokens: [tokenId],
            metrics: {
                priceChange
            }
        };
        await this.publishHCSMessage(TOPICS.GOVERNANCE_PROPOSALS, message);
    }
    // Propose a rebalance
    async proposeRebalance(newWeights, executeAfter, quorum) {
        const message = {
            type: 'RebalanceProposal',
            timestamp: Date.now(),
            sender: AGENTS.REBALANCE.id,
            proposalId: `prop-${Date.now()}`,
            newWeights,
            executeAfter,
            quorum,
            description: 'Proposed rebalance to maintain target weights'
        };
        await this.publishHCSMessage(TOPICS.GOVERNANCE_PROPOSALS, message);
    }
    // Approve a rebalance proposal
    async approveRebalance(proposalId) {
        const message = {
            type: 'RebalanceApproved',
            timestamp: Date.now(),
            sender: AGENTS.REBALANCE.id,
            proposalId,
            approvedAt: Date.now(),
            approvedBy: AGENTS.REBALANCE.id
        };
        await this.publishHCSMessage(TOPICS.GOVERNANCE_PROPOSALS, message);
    }
    // Execute a rebalance
    async executeRebalance(proposalId, newWeights) {
        // Get current balances from the token service
        const preBalances = {}; // TODO: Implement getting current balances
        const message = {
            type: 'RebalanceExecuted',
            timestamp: Date.now(),
            sender: AGENTS.REBALANCE.id,
            proposalId,
            preBalances,
            postBalances: newWeights,
            executedAt: Date.now(),
            executedBy: AGENTS.REBALANCE.id
        };
        await this.publishHCSMessage(TOPICS.AGENT_ACTIONS, message);
    }
    // Initialize agent subscriptions
    async initializeAgents() {
        // Price Feed Agent
        await this.subscribeToTopic(TOPICS.MARKET_PRICE_FEED, async (message) => {
            if (message.type === 'PriceUpdate') {
                await this.processPriceUpdate(message.price, message.tokenId);
            }
        });
        // Risk Assessment Agent
        await this.subscribeToTopic(TOPICS.MARKET_PRICE_FEED, async (message) => {
            if (message.type === 'PriceUpdate') {
                const lastPrice = this.lastPrices.get(message.tokenId);
                if (lastPrice) {
                    const priceChange = ((message.price - lastPrice) / lastPrice) * 100;
                    if (Math.abs(priceChange) >= AGENTS.PRICE_FEED.threshold) {
                        await this.assessRisk(priceChange, message.tokenId);
                    }
                }
            }
        });
        // Rebalance Agent
        await this.subscribeToTopic(TOPICS.GOVERNANCE_PROPOSALS, async (message) => {
            if (message.type === 'RebalanceApproved') {
                const proposal = await this.getProposal(message.proposalId);
                if (proposal?.type === 'RebalanceProposal') {
                    await this.executeRebalance(message.proposalId, proposal.newWeights);
                }
            }
        });
    }
    // Helper function to get proposal details
    async getProposal(proposalId) {
        // TODO: Implement proposal retrieval from HCS
        return null;
    }
}
exports.HederaService = HederaService;
// Create singleton instance
exports.hederaService = new HederaService();
