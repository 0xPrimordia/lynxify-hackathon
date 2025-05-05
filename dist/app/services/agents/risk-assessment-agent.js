"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAssessmentAgent = void 0;
var base_agent_1 = require("./base-agent");
var RiskAssessmentAgent = /** @class */ (function (_super) {
    __extends(RiskAssessmentAgent, _super);
    function RiskAssessmentAgent(hederaService) {
        var _this = _super.call(this, {
            id: 'risk-assessment-agent',
            type: 'risk-assessment',
            hederaService: hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_AGENT_TOPIC_ID,
                output: process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID
            }
        }) || this;
        _this.priceHistory = new Map();
        _this.priceHistoryLength = 24; // Store 24 price points
        _this.riskThresholds = {
            high: 0.1, // 10% price change
            medium: 0.05, // 5% price change
            low: 0.02 // 2% price change
        };
        return _this;
    }
    RiskAssessmentAgent.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(message.type === 'PriceUpdate')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.handlePriceUpdate(message)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    RiskAssessmentAgent.prototype.handlePriceUpdate = function (update) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenId, price, history, priceChange, volatility, severity, riskAlert;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tokenId = update.tokenId, price = update.price;
                        // Initialize price history if not exists
                        if (!this.priceHistory.has(tokenId)) {
                            this.priceHistory.set(tokenId, []);
                        }
                        history = this.priceHistory.get(tokenId);
                        history.push(price);
                        // Keep only the last N price points
                        if (history.length > this.priceHistoryLength) {
                            history.shift();
                        }
                        if (!(history.length >= 2)) return [3 /*break*/, 2];
                        priceChange = Math.abs((price - history[0]) / history[0]);
                        volatility = this.calculateVolatility(history);
                        severity = 'low';
                        if (priceChange >= this.riskThresholds.high) {
                            severity = 'high';
                        }
                        else if (priceChange >= this.riskThresholds.medium) {
                            severity = 'medium';
                        }
                        if (!(severity !== 'low')) return [3 /*break*/, 2];
                        riskAlert = {
                            type: 'RiskAlert',
                            timestamp: Date.now(),
                            sender: this.id,
                            severity: severity,
                            description: "Significant price change detected for token ".concat(tokenId),
                            affectedTokens: [tokenId],
                            metrics: {
                                volatility: volatility,
                                priceChange: priceChange
                            }
                        };
                        return [4 /*yield*/, this.publishHCSMessage(riskAlert)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    RiskAssessmentAgent.prototype.calculateVolatility = function (prices) {
        if (prices.length < 2)
            return 0;
        var returns = prices.slice(1).map(function (price, i) {
            return (price - prices[i]) / prices[i];
        });
        var mean = returns.reduce(function (sum, ret) { return sum + ret; }, 0) / returns.length;
        var variance = returns.reduce(function (sum, ret) { return sum + Math.pow(ret - mean, 2); }, 0) / returns.length;
        return Math.sqrt(variance);
    };
    return RiskAssessmentAgent;
}(base_agent_1.BaseAgent));
exports.RiskAssessmentAgent = RiskAssessmentAgent;
