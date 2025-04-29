"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRebalanceAgent = exports.AIRebalanceAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const hedera_1 = require("../hedera");
class AIRebalanceAgent {
    constructor() {
        this.lastRebalanceTime = 0;
        this.rebalanceIntervalHours = 24; // Default to daily rebalancing
        this.marketData = {
            prices: {},
            priceChanges: {},
            volumes: {},
            volatility: {}
        };
        this.treasuryState = null;
        // Initialize OpenAI client
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key is required for AI Rebalance Agent');
        }
        this.openai = new openai_1.default({ apiKey });
        // Define supported tokens with their sectors
        this.supportedTokens = [
            { symbol: 'HBAR', name: 'Hedera', sector: 'Smart Contract Platforms', currentWeight: 0.20 },
            { symbol: 'WBTC', name: 'Wrapped Bitcoin', sector: 'Smart Contract Platforms', currentWeight: 0.15 },
            { symbol: 'WETH', name: 'Wrapped Ethereum', sector: 'Smart Contract Platforms', currentWeight: 0.10 },
            { symbol: 'USDC', name: 'USD Coin', sector: 'Stablecoins', currentWeight: 0.15 },
            { symbol: 'USDT', name: 'Tether', sector: 'Stablecoins', currentWeight: 0.10 },
            { symbol: 'DAI', name: 'Dai', sector: 'Stablecoins', currentWeight: 0.05 },
            { symbol: 'SAUCE', name: 'SaucerSwap', sector: 'DeFi & DEX Tokens', currentWeight: 0.10 },
            { symbol: 'HBARX', name: 'Stader HBARX', sector: 'DeFi & DEX Tokens', currentWeight: 0.15 }
        ];
    }
    async updateMarketData(data) {
        // Update market data with new information
        this.marketData = { ...this.marketData, ...data };
        console.log('🧠 AI AGENT: Market data updated', this.marketData);
    }
    async updateTreasuryState(treasury) {
        this.treasuryState = treasury;
        console.log('🧠 AI AGENT: Treasury state updated', {
            totalValue: treasury.totalValue,
            tokenCount: Object.keys(treasury.holdings).length
        });
        // Update the current weights in supportedTokens based on treasury data
        if (treasury && treasury.holdings) {
            this.supportedTokens.forEach(token => {
                const holding = treasury.holdings[token.symbol];
                if (holding) {
                    token.currentWeight = holding.weight;
                }
            });
        }
    }
    async generateRebalanceProposal() {
        const now = Date.now();
        // Always allow rebalance for demo purposes
        this.lastRebalanceTime = 0;
        // Check if enough time has passed since last rebalance
        if (now - this.lastRebalanceTime < this.rebalanceIntervalHours * 60 * 60 * 1000) {
            console.log('🧠 AI AGENT: Not enough time has passed since last rebalance');
            return {
                success: false,
                message: 'Not enough time has passed since the last rebalance'
            };
        }
        try {
            // Generate new portfolio allocation
            const newWeights = await this.generatePortfolioAllocation();
            // Create detailed analysis of the proposed changes
            const analysis = await this.analyzeProposedChanges(newWeights);
            // No longer conditionally submitting to HCS - that's handled in the API
            // Update last rebalance time
            this.lastRebalanceTime = now;
            return {
                success: true,
                newWeights,
                analysis
            };
        }
        catch (error) {
            console.error('❌ AI AGENT ERROR: Failed to generate rebalance:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error generating proposal'
            };
        }
    }
    async generatePortfolioAllocation() {
        console.log('🧠 AI AGENT: Generating optimal portfolio allocation...');
        // Get current token information and market conditions
        const currentTokens = this.supportedTokens.map(token => ({
            ...token,
            price: this.marketData.prices[token.symbol] || 100, // Default price if not available
            priceChange: this.marketData.priceChanges[token.symbol] || 0,
            volume: this.marketData.volumes[token.symbol] || 1000000,
            volatility: this.marketData.volatility[token.symbol] || 0.05
        }));
        // If we have treasury data, include it in the prompt
        const treasuryInfo = this.treasuryState ? `
    CURRENT TREASURY HOLDINGS:
    Total Value: $${(this.treasuryState.totalValue / 1000000).toFixed(2)} million
    
    ${Object.entries(this.treasuryState.holdings).map(([token, holding]) => `
    ${token}:
      Amount: ${holding.amount.toLocaleString()} tokens
      Value: $${(holding.value / 1000000).toFixed(2)} million
      Weight: ${(holding.weight * 100).toFixed(2)}%
    `).join('')}
    ` : '';
        // Create detailed prompt for the AI
        const prompt = `
    You are an expert AI asset manager for a tokenized index fund. Your task is to generate an optimal portfolio allocation based on the following market data:
    
    ${treasuryInfo}
    
    CURRENT TOKEN DATA:
    ${currentTokens.map(token => `
    ${token.symbol} (${token.name}) - ${token.sector}:
      Current Weight: ${(token.currentWeight * 100).toFixed(2)}%
      Price: $${token.price.toFixed(2)}
      24h Change: ${token.priceChange.toFixed(2)}%
      Volume: $${token.volume.toLocaleString()}
      Volatility: ${(token.volatility * 100).toFixed(2)}%
    `).join('')}
    
    INVESTMENT GUIDELINES:
    1. Maintain sector diversification according to the fund mandate
    2. Smart Contract Platforms: 30-50% total allocation
    3. Stablecoins: 20-40% total allocation 
    4. DeFi & DEX Tokens: 15-35% total allocation
    5. No single token can exceed 25% allocation
    6. Total allocation must sum to 100%
    7. When market volatility is high, increase stablecoin allocation
    8. When smart contract tokens show strong momentum, increase their allocation
    9. Minimize drastic changes from current weights unless justified by strong market signals
    
    Based on this data, generate a new optimal portfolio allocation that includes a weight for each token. Return ONLY the allocation as a JSON object with token symbols as keys and decimal weights (e.g., 0.20 for 20%) as values. The weights must sum to 1.0 exactly.
    `;
        try {
            // Call OpenAI API to generate allocation
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are an advanced AI asset manager. Respond only with the requested JSON data structure without any explanations or additional text.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });
            // Parse response and validate
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response received from OpenAI');
            }
            const newWeights = JSON.parse(content);
            // Validate weights sum to 1.0
            const weightSum = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
            if (Math.abs(weightSum - 1.0) > 0.01) {
                console.warn(`⚠️ AI AGENT: Generated weights do not sum to 1.0 (${weightSum}), normalizing...`);
                // Normalize weights
                Object.keys(newWeights).forEach(token => {
                    newWeights[token] = newWeights[token] / weightSum;
                });
            }
            console.log('✅ AI AGENT: Generated new portfolio allocation:', newWeights);
            return newWeights;
        }
        catch (error) {
            console.error('❌ AI AGENT ERROR: Failed to generate portfolio allocation:', error);
            // Fallback to a reasonable default allocation
            const defaultWeights = {};
            this.supportedTokens.forEach(token => {
                defaultWeights[token.symbol] = token.currentWeight;
            });
            return defaultWeights;
        }
    }
    async analyzeProposedChanges(newWeights) {
        console.log('🧠 AI AGENT: Analyzing proposed changes...');
        // Create a detailed analysis prompt
        const prompt = `
    You are an expert AI asset manager explaining a portfolio rebalance decision.
    
    PREVIOUS ALLOCATION:
    ${this.supportedTokens.map(token => `${token.symbol} (${token.name}): ${(token.currentWeight * 100).toFixed(2)}%`).join('\n')}
    
    NEW ALLOCATION:
    ${Object.entries(newWeights).map(([symbol, weight]) => `${symbol}: ${(weight * 100).toFixed(2)}%`).join('\n')}
    
    CHANGES:
    ${this.supportedTokens.map(token => {
            const newWeight = newWeights[token.symbol] || 0;
            const change = newWeight - token.currentWeight;
            const direction = change > 0 ? 'Increased' : change < 0 ? 'Decreased' : 'Unchanged';
            return `${token.symbol}: ${direction} by ${Math.abs(change * 100).toFixed(2)}%`;
        }).join('\n')}
    
    MARKET CONDITIONS:
    ${Object.entries(this.marketData.prices)
            .filter(([token]) => this.supportedTokens.some(t => t.symbol === token))
            .map(([token, price]) => {
            const priceChange = this.marketData.priceChanges[token] || 0;
            const volatility = this.marketData.volatility[token] || 0;
            return `${token}: $${price.toFixed(2)}, ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% change, ${(volatility * 100).toFixed(2)}% volatility`;
        }).join('\n')}
    
    Please provide a professional, concise analysis (3-4 sentences) of this rebalance decision, explaining:
    1. The strategic rationale behind the main changes
    2. How this allocation responds to current market conditions
    3. The expected benefits of this new allocation
    
    Keep your response under 200 words and focus on clarity and insight.
    `;
        try {
            // Call OpenAI API to generate analysis
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are an advanced AI asset manager. Provide clear, concise, and professional analysis.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200
            });
            const analysis = response.choices[0]?.message?.content ||
                'Analysis unavailable. The portfolio has been rebalanced based on current market conditions and optimization algorithms.';
            console.log('✅ AI AGENT: Generated analysis:', analysis);
            return analysis;
        }
        catch (error) {
            console.error('❌ AI AGENT ERROR: Failed to generate analysis:', error);
            return 'Analysis unavailable. The portfolio has been rebalanced based on current market conditions and optimization algorithms.';
        }
    }
    async submitRebalanceProposal(newWeights, analysis) {
        console.log('🧠 AI AGENT: Submitting rebalance proposal...');
        // Calculate when to execute (e.g., 24 hours from now)
        const executeAfter = Date.now() + (24 * 60 * 60 * 1000);
        // Set a reasonable quorum for voting
        const quorum = 5000; // Example: 5000 voting power required
        // Submit the proposal via Hedera service
        await hedera_1.hederaService.proposeRebalance(newWeights, executeAfter, quorum, 'scheduled', // Using a valid trigger type from the allowed options
        analysis);
        console.log('✅ AI AGENT: Rebalance proposal submitted successfully');
    }
    // Legacy method to maintain compatibility
    async checkAndGenerateRebalance() {
        const result = await this.generateRebalanceProposal();
        return result.success;
    }
}
exports.AIRebalanceAgent = AIRebalanceAgent;
// Create singleton instance
exports.aiRebalanceAgent = new AIRebalanceAgent();
