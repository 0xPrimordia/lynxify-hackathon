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
    start() {
        const _super = Object.create(null, {
            start: { get: () => super.start }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.start.call(this);
            this.startPriceUpdates();
        });
    }
    stop() {
        const _super = Object.create(null, {
            stop: { get: () => super.stop }
        });
        return __awaiter(this, void 0, void 0, function* () {
            this.stopPriceUpdates();
            yield _super.stop.call(this);
        });
    }
    startPriceUpdates() {
        if (this.updateInterval) {
            return;
        }
        this.updateInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
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
                    yield this.publishHCSMessage(priceUpdate);
                }
            }
            catch (error) {
                console.error('Error publishing price update:', error);
            }
        }), this.updateFrequency);
    }
    stopPriceUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            // Price feed agent doesn't need to handle incoming messages
            // It only publishes price updates
        });
    }
}
exports.PriceFeedAgent = PriceFeedAgent;
