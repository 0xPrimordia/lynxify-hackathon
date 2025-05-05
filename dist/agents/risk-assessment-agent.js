"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAssessmentAgent = void 0;
const base_agent_1 = require("./base-agent");
class RiskAssessmentAgent extends base_agent_1.BaseAgent {
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
    handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.type === 'PriceUpdate') {
                yield this.handlePriceUpdate(message);
            }
        });
    }
    handlePriceUpdate(update) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tokenId, price } = update;
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
                        type: 'RiskAlert',
                        timestamp: Date.now(),
                        sender: this.id,
                        severity,
                        description: `Significant price change detected for token ${tokenId}`,
                        affectedTokens: [tokenId],
                        metrics: {
                            volatility,
                            priceChange
                        }
                    };
                    yield this.publishHCSMessage(riskAlert);
                }
            }
        });
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
exports.RiskAssessmentAgent = RiskAssessmentAgent;
