import { BaseAgent } from './base-agent';
export class RiskAssessmentAgent extends BaseAgent {
    constructor(hederaService) {
        super({
            id: 'risk-assessment-agent',
            type: 'risk-assessment',
            hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID,
                output: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID
            }
        });
        this.priceHistory = new Map();
        this.priceHistoryLength = 24; // Store 24 price points
        this.riskThresholds = {
            high: 0.1, // 10% price change
            medium: 0.05, // 5% price change
            low: 0.02 // 2% price change
        };
    }
    async handleMessage(message) {
        if (message.type === 'PriceUpdate') {
            await this.handlePriceUpdate(message);
        }
    }
    async handlePriceUpdate(update) {
        const tokenId = update.details.tokenId;
        const price = update.details.price;
        // Initialize price history if not exists
        if (!this.priceHistory.has(tokenId)) {
            this.priceHistory.set(tokenId, []);
        }
        const history = this.priceHistory.get(tokenId);
        history.push(price);
        // Keep only the last N price points
        if (history.length > this.priceHistoryLength) {
            history.shift();
        }
        // Calculate price change
        if (history.length >= 2) {
            const priceChange = Math.abs((price - history[0]) / history[0]);
            const volatility = this.calculateVolatility(history);
            // Determine risk level
            let severity = 'low';
            if (priceChange >= this.riskThresholds.high) {
                severity = 'high';
            }
            else if (priceChange >= this.riskThresholds.medium) {
                severity = 'medium';
            }
            // Publish risk alert if significant change detected
            if (severity !== 'low') {
                const riskAlert = {
                    id: `risk-${Date.now()}-${tokenId}`,
                    type: 'RiskAlert',
                    timestamp: Date.now(),
                    sender: this.id,
                    details: {
                        severity,
                        riskDescription: `Significant price change detected for token ${tokenId}`,
                        affectedTokens: [tokenId],
                        metrics: {
                            volatility,
                            priceChange
                        }
                    }
                };
                await this.publishHCSMessage(riskAlert);
            }
        }
    }
    calculateVolatility(prices) {
        if (prices.length < 2)
            return 0;
        const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
}
