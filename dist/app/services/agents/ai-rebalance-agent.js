"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRebalanceAgent = exports.AIRebalanceAgent = void 0;
var openai_1 = __importDefault(require("openai"));
var hedera_1 = require("../hedera");
var AIRebalanceAgent = /** @class */ (function () {
    function AIRebalanceAgent() {
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
        var apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key is required for AI Rebalance Agent');
        }
        this.openai = new openai_1.default({ apiKey: apiKey });
        // Define supported tokens with their sectors - USING ACTUAL TOKEN SYMBOLS FROM token-data.json
        this.supportedTokens = [
            { symbol: 'BTC', name: 'Bitcoin', sector: 'Large Cap', currentWeight: 0.40 },
            { symbol: 'ETH', name: 'Ethereum', sector: 'Large Cap', currentWeight: 0.30 },
            { symbol: 'SOL', name: 'Solana', sector: 'Large Cap', currentWeight: 0.20 },
            { symbol: 'Lynxify-Index', name: 'Lynxify Index', sector: 'Index Token', currentWeight: 0.10 }
        ];
    }
    AIRebalanceAgent.prototype.updateMarketData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Update market data with new information
                this.marketData = __assign(__assign({}, this.marketData), data);
                console.log('🧠 AI AGENT: Market data updated', this.marketData);
                return [2 /*return*/];
            });
        });
    };
    AIRebalanceAgent.prototype.updateTreasuryState = function (treasury) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.treasuryState = treasury;
                console.log('🧠 AI AGENT: Treasury state updated', {
                    totalValue: treasury.totalValue,
                    tokenCount: Object.keys(treasury.holdings).length
                });
                // Update the current weights in supportedTokens based on treasury data
                if (treasury && treasury.holdings) {
                    this.supportedTokens.forEach(function (token) {
                        var holding = treasury.holdings[token.symbol];
                        if (holding) {
                            token.currentWeight = holding.weight;
                        }
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    AIRebalanceAgent.prototype.generateRebalanceProposal = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, newWeights, analysis, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = Date.now();
                        // Always allow rebalance for demo purposes
                        this.lastRebalanceTime = 0;
                        // Check if enough time has passed since last rebalance
                        if (now - this.lastRebalanceTime < this.rebalanceIntervalHours * 60 * 60 * 1000) {
                            console.log('🧠 AI AGENT: Not enough time has passed since last rebalance');
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Not enough time has passed since the last rebalance'
                                }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.generatePortfolioAllocation()];
                    case 2:
                        newWeights = _a.sent();
                        return [4 /*yield*/, this.analyzeProposedChanges(newWeights)];
                    case 3:
                        analysis = _a.sent();
                        // No longer conditionally submitting to HCS - that's handled in the API
                        // Update last rebalance time
                        this.lastRebalanceTime = now;
                        return [2 /*return*/, {
                                success: true,
                                newWeights: newWeights,
                                analysis: analysis
                            }];
                    case 4:
                        error_1 = _a.sent();
                        console.error('❌ AI AGENT ERROR: Failed to generate rebalance:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Unknown error generating proposal'
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AIRebalanceAgent.prototype.generatePortfolioAllocation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var currentTokens, treasuryInfo, prompt, response, content, newWeights_1, weightSum_1, error_2, defaultWeights_1;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log('🧠 AI AGENT: Generating optimal portfolio allocation...');
                        currentTokens = this.supportedTokens.map(function (token) { return (__assign(__assign({}, token), { price: _this.marketData.prices[token.symbol] || 100, priceChange: _this.marketData.priceChanges[token.symbol] || 0, volume: _this.marketData.volumes[token.symbol] || 1000000, volatility: _this.marketData.volatility[token.symbol] || 0.05 })); });
                        treasuryInfo = this.treasuryState ? "\n    CURRENT TREASURY HOLDINGS:\n    Total Value: $".concat((this.treasuryState.totalValue / 1000000).toFixed(2), " million\n    \n    ").concat(Object.entries(this.treasuryState.holdings).map(function (_a) {
                            var token = _a[0], holding = _a[1];
                            return "\n    ".concat(token, ":\n      Amount: ").concat(holding.amount.toLocaleString(), " tokens\n      Value: $").concat((holding.value / 1000000).toFixed(2), " million\n      Weight: ").concat((holding.weight * 100).toFixed(2), "%\n    ");
                        }).join(''), "\n    ") : '';
                        prompt = "\n    You are an expert AI asset manager for a tokenized index fund. Your task is to generate an optimal portfolio allocation based on the following market data:\n    \n    ".concat(treasuryInfo, "\n    \n    CURRENT TOKEN DATA:\n    ").concat(currentTokens.map(function (token) { return "\n    ".concat(token.symbol, " (").concat(token.name, ") - ").concat(token.sector, ":\n      Current Weight: ").concat((token.currentWeight * 100).toFixed(2), "%\n      Price: $").concat(token.price.toFixed(2), "\n      24h Change: ").concat(token.priceChange.toFixed(2), "%\n      Volume: $").concat(token.volume.toLocaleString(), "\n      Volatility: ").concat((token.volatility * 100).toFixed(2), "%\n    "); }).join(''), "\n    \n    INVESTMENT GUIDELINES:\n    1. Maintain sector diversification according to the fund mandate\n    2. Smart Contract Platforms: 30-50% total allocation\n    3. Stablecoins: 20-40% total allocation \n    4. DeFi & DEX Tokens: 15-35% total allocation\n    5. No single token can exceed 25% allocation\n    6. Total allocation must sum to 100%\n    7. When market volatility is high, increase stablecoin allocation\n    8. When smart contract tokens show strong momentum, increase their allocation\n    9. Minimize drastic changes from current weights unless justified by strong market signals\n    \n    Based on this data, generate a new optimal portfolio allocation that includes a weight for each token. Return ONLY the allocation as a JSON object with token symbols as keys and decimal weights (e.g., 0.20 for 20%) as values. The weights must sum to 1.0 exactly.\n    ");
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: 'gpt-3.5-turbo',
                                messages: [
                                    { role: 'system', content: 'You are an advanced AI asset manager. Respond only with the requested JSON data structure without any explanations or additional text.' },
                                    { role: 'user', content: prompt }
                                ],
                                response_format: { type: 'json_object' }
                            })];
                    case 2:
                        response = _c.sent();
                        content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
                        if (!content) {
                            throw new Error('No response received from OpenAI');
                        }
                        newWeights_1 = JSON.parse(content);
                        weightSum_1 = Object.values(newWeights_1).reduce(function (sum, weight) { return sum + weight; }, 0);
                        if (Math.abs(weightSum_1 - 1.0) > 0.01) {
                            console.warn("\u26A0\uFE0F AI AGENT: Generated weights do not sum to 1.0 (".concat(weightSum_1, "), normalizing..."));
                            // Normalize weights
                            Object.keys(newWeights_1).forEach(function (token) {
                                newWeights_1[token] = newWeights_1[token] / weightSum_1;
                            });
                        }
                        console.log('✅ AI AGENT: Generated new portfolio allocation:', newWeights_1);
                        return [2 /*return*/, newWeights_1];
                    case 3:
                        error_2 = _c.sent();
                        console.error('❌ AI AGENT ERROR: Failed to generate portfolio allocation:', error_2);
                        defaultWeights_1 = {};
                        this.supportedTokens.forEach(function (token) {
                            defaultWeights_1[token.symbol] = token.currentWeight;
                        });
                        return [2 /*return*/, defaultWeights_1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AIRebalanceAgent.prototype.analyzeProposedChanges = function (newWeights) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt, response, analysis, error_3;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log('🧠 AI AGENT: Analyzing proposed changes...');
                        prompt = "\n    You are an expert AI asset manager explaining a portfolio rebalance decision.\n    \n    PREVIOUS ALLOCATION:\n    ".concat(this.supportedTokens.map(function (token) {
                            return "".concat(token.symbol, " (").concat(token.name, "): ").concat((token.currentWeight * 100).toFixed(2), "%");
                        }).join('\n'), "\n    \n    NEW ALLOCATION:\n    ").concat(Object.entries(newWeights).map(function (_a) {
                            var symbol = _a[0], weight = _a[1];
                            return "".concat(symbol, ": ").concat((weight * 100).toFixed(2), "%");
                        }).join('\n'), "\n    \n    CHANGES:\n    ").concat(this.supportedTokens.map(function (token) {
                            var newWeight = newWeights[token.symbol] || 0;
                            var change = newWeight - token.currentWeight;
                            var direction = change > 0 ? 'Increased' : change < 0 ? 'Decreased' : 'Unchanged';
                            return "".concat(token.symbol, ": ").concat(direction, " by ").concat(Math.abs(change * 100).toFixed(2), "%");
                        }).join('\n'), "\n    \n    MARKET CONDITIONS:\n    ").concat(Object.entries(this.marketData.prices)
                            .filter(function (_a) {
                            var token = _a[0];
                            return _this.supportedTokens.some(function (t) { return t.symbol === token; });
                        })
                            .map(function (_a) {
                            var token = _a[0], price = _a[1];
                            var priceChange = _this.marketData.priceChanges[token] || 0;
                            var volatility = _this.marketData.volatility[token] || 0;
                            return "".concat(token, ": $").concat(price.toFixed(2), ", ").concat(priceChange >= 0 ? '+' : '').concat(priceChange.toFixed(2), "% change, ").concat((volatility * 100).toFixed(2), "% volatility");
                        }).join('\n'), "\n    \n    Please provide a professional, concise analysis (3-4 sentences) of this rebalance decision, explaining:\n    1. The strategic rationale behind the main changes\n    2. How this allocation responds to current market conditions\n    3. The expected benefits of this new allocation\n    \n    Keep your response under 200 words and focus on clarity and insight.\n    ");
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: 'gpt-3.5-turbo',
                                messages: [
                                    { role: 'system', content: 'You are an advanced AI asset manager. Provide clear, concise, and professional analysis.' },
                                    { role: 'user', content: prompt }
                                ],
                                max_tokens: 200
                            })];
                    case 2:
                        response = _c.sent();
                        analysis = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) ||
                            'Analysis unavailable. The portfolio has been rebalanced based on current market conditions and optimization algorithms.';
                        console.log('✅ AI AGENT: Generated analysis:', analysis);
                        return [2 /*return*/, analysis];
                    case 3:
                        error_3 = _c.sent();
                        console.error('❌ AI AGENT ERROR: Failed to generate analysis:', error_3);
                        return [2 /*return*/, 'Analysis unavailable. The portfolio has been rebalanced based on current market conditions and optimization algorithms.'];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AIRebalanceAgent.prototype.submitRebalanceProposal = function (newWeights, analysis) {
        return __awaiter(this, void 0, void 0, function () {
            var executeAfter, quorum;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🧠 AI AGENT: Submitting rebalance proposal...');
                        executeAfter = Date.now() + (24 * 60 * 60 * 1000);
                        quorum = 5000;
                        // Submit the proposal via Hedera service
                        return [4 /*yield*/, hedera_1.hederaService.proposeRebalance(newWeights, executeAfter, quorum, 'scheduled', // Using a valid trigger type from the allowed options
                            analysis)];
                    case 1:
                        // Submit the proposal via Hedera service
                        _a.sent();
                        console.log('✅ AI AGENT: Rebalance proposal submitted successfully');
                        return [2 /*return*/];
                }
            });
        });
    };
    // Legacy method to maintain compatibility
    AIRebalanceAgent.prototype.checkAndGenerateRebalance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateRebalanceProposal()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.success];
                }
            });
        });
    };
    return AIRebalanceAgent;
}());
exports.AIRebalanceAgent = AIRebalanceAgent;
// Create singleton instance
exports.aiRebalanceAgent = new AIRebalanceAgent();
