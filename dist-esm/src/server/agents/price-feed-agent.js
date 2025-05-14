"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceFeedAgent = void 0;
const base_agent_1 = require("./base-agent");
class PriceFeedAgent extends base_agent_1.BaseAgent {
    constructor(hederaService) {
        super({
            id: 'price-feed',
            type: 'price-feed',
            hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID,
                output: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID
            }
        });
        this.updateInterval = null;
        this.updateFrequency = 30000; // 30 seconds
        this.tokens = [
            { tokenId: '0.0.1234567', symbol: 'BTC', basePrice: 50000, volatility: 0.02 },
            { tokenId: '0.0.1234568', symbol: 'ETH', basePrice: 3000, volatility: 0.03 },
            { tokenId: '0.0.1234569', symbol: 'USDC', basePrice: 1, volatility: 0.001 }
        ];
    }
    async start() {
        await super.start();
        this.startPriceUpdates();
    }
    async stop() {
        this.stopPriceUpdates();
        await super.stop();
    }
    startPriceUpdates() {
        if (this.updateInterval) {
            return;
        }
        this.updateInterval = setInterval(async () => {
            try {
                // Simulate price updates for demo purposes
                for (const token of this.tokens) {
                    const priceChange = (Math.random() - 0.5) * 2 * token.volatility;
                    const newPrice = token.basePrice * (1 + priceChange);
                    const priceUpdate = {
                        type: 'PriceUpdate',
                        timestamp: Date.now(),
                        sender: this.id,
                        tokenId: token.tokenId,
                        price: newPrice,
                        source: 'simulated'
                    };
                    await this.publishHCSMessage(priceUpdate);
                }
            }
            catch (error) {
                console.error('Error publishing price update:', error);
            }
        }, this.updateFrequency);
    }
    stopPriceUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    async handleMessage(message) {
        // Price feed agent doesn't need to handle incoming messages
        // It only publishes price updates
    }
}
exports.PriceFeedAgent = PriceFeedAgent;
