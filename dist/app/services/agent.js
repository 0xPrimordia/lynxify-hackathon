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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebalanceAgent = exports.Agent = void 0;
var ai_1 = require("./ai");
// Mock data for the prototype
var MOCK_TOKENS = {
    HBAR: {
        symbol: "HBAR",
        price: 0.12,
        volume24h: 50000000,
        liquidityDepth: 25000000
    },
    USDC: {
        symbol: "USDC",
        price: 1.00,
        volume24h: 100000000,
        liquidityDepth: 50000000
    },
    ETH: {
        symbol: "ETH",
        price: 3500.00,
        volume24h: 75000000,
        liquidityDepth: 35000000
    }
};
var Agent = /** @class */ (function () {
    function Agent(hederaService) {
        this.isRunning = false;
        this.hederaService = hederaService;
    }
    Agent.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var governanceTopicId, agentTopicId;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRunning) {
                            throw new Error('Agent is already running');
                        }
                        governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID;
                        agentTopicId = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID;
                        return [4 /*yield*/, this.hederaService.subscribeToTopic(governanceTopicId, function (message) {
                                _this.handleMessage(message).catch(function (error) {
                                    console.error('Error handling message:', error);
                                });
                            })];
                    case 1:
                        _a.sent();
                        this.isRunning = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    Agent.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var governanceTopicId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isRunning) {
                            throw new Error('Agent is not running');
                        }
                        governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID;
                        return [4 /*yield*/, this.hederaService.unsubscribeFromTopic(governanceTopicId)];
                    case 1:
                        _a.sent();
                        this.isRunning = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    Agent.prototype.publishMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var agentTopicId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isRunning) {
                            throw new Error('Agent is not running');
                        }
                        agentTopicId = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID;
                        return [4 /*yield*/, this.hederaService.publishHCSMessage(agentTopicId, message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Agent.prototype.publishRebalanceExecuted = function (proposalId, preBalances, postBalances) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        message = {
                            type: 'RebalanceExecuted',
                            timestamp: Date.now(),
                            sender: 'agent',
                            proposalId: proposalId,
                            preBalances: preBalances,
                            postBalances: postBalances,
                            executedAt: Date.now(),
                            executedBy: 'agent'
                        };
                        return [4 /*yield*/, this.publishMessage(message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return Agent;
}());
exports.Agent = Agent;
var RebalanceAgent = /** @class */ (function (_super) {
    __extends(RebalanceAgent, _super);
    function RebalanceAgent(hederaService) {
        var _this = _super.call(this, hederaService) || this;
        _this.currentBalances = [];
        _this.aiService = new ai_1.AIService();
        return _this;
    }
    RebalanceAgent.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = message.type;
                        switch (_a) {
                            case 'RebalanceProposal': return [3 /*break*/, 1];
                            case 'RebalanceApproved': return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 4];
                    case 1:
                        // Store proposal for later execution
                        console.log('Received rebalance proposal:', message);
                        return [3 /*break*/, 5];
                    case 2: 
                    // Execute the approved rebalance
                    return [4 /*yield*/, this.executeRebalance(message.proposalId)];
                    case 3:
                        // Execute the approved rebalance
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        console.log('Unknown message type:', message.type);
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    RebalanceAgent.prototype.executeRebalance = function (proposalId) {
        return __awaiter(this, void 0, void 0, function () {
            var marketData, currentBalances, currentWeights, decisions, postBalances, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.fetchMarketData()];
                    case 1:
                        marketData = _a.sent();
                        return [4 /*yield*/, this.fetchTokenBalances()];
                    case 2:
                        currentBalances = _a.sent();
                        this.currentBalances = currentBalances;
                        currentWeights = this.calculateWeights(currentBalances);
                        return [4 /*yield*/, this.aiService.analyzeMarketAndDecideRebalance(currentWeights, marketData)];
                    case 3:
                        decisions = _a.sent();
                        return [4 /*yield*/, this.executeTrades(decisions)];
                    case 4:
                        postBalances = _a.sent();
                        // Publish execution result to agent topic
                        return [4 /*yield*/, this.publishRebalanceExecuted(proposalId, this.currentBalances.reduce(function (acc, balance) {
                                var _a;
                                return (__assign(__assign({}, acc), (_a = {}, _a[balance.token] = balance.amount, _a)));
                            }, {}), postBalances.reduce(function (acc, balance) {
                                var _a;
                                return (__assign(__assign({}, acc), (_a = {}, _a[balance.token] = balance.amount, _a)));
                            }, {}))];
                    case 5:
                        // Publish execution result to agent topic
                        _a.sent();
                        console.log('Rebalance executed and logged:', proposalId);
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error('Failed to execute rebalance:', error_1);
                        throw error_1;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    RebalanceAgent.prototype.fetchMarketData = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Mock market data for the prototype
                return [2 /*return*/, Object.values(MOCK_TOKENS).map(function (token) { return ({
                        token: token.symbol,
                        price: token.price,
                        volume24h: token.volume24h,
                        liquidityDepth: token.liquidityDepth,
                        lastUpdated: Date.now()
                    }); })];
            });
        });
    };
    RebalanceAgent.prototype.fetchTokenBalances = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Mock token balances for the prototype
                return [2 /*return*/, [
                        {
                            token: "HBAR",
                            amount: 1000000, // 1M HBAR
                            value: 1000000 * MOCK_TOKENS.HBAR.price
                        },
                        {
                            token: "USDC",
                            amount: 500000, // 500K USDC
                            value: 500000 * MOCK_TOKENS.USDC.price
                        },
                        {
                            token: "ETH",
                            amount: 100, // 100 ETH
                            value: 100 * MOCK_TOKENS.ETH.price
                        }
                    ]];
            });
        });
    };
    RebalanceAgent.prototype.calculateWeights = function (balances) {
        var totalValue = balances.reduce(function (sum, balance) { return sum + balance.value; }, 0);
        return balances.reduce(function (weights, balance) {
            var _a;
            return (__assign(__assign({}, weights), (_a = {}, _a[balance.token] = (balance.value / totalValue) * 100, _a)));
        }, {});
    };
    RebalanceAgent.prototype.executeTrades = function (decisions) {
        return __awaiter(this, void 0, void 0, function () {
            var totalValue;
            return __generator(this, function (_a) {
                totalValue = this.currentBalances.reduce(function (sum, balance) { return sum + balance.value; }, 0);
                return [2 /*return*/, decisions.map(function (decision) {
                        var targetValue = (decision.targetWeight / 100) * totalValue;
                        var token = MOCK_TOKENS[decision.token];
                        var amount = targetValue / token.price;
                        return {
                            token: decision.token,
                            amount: amount,
                            value: targetValue
                        };
                    })];
            });
        });
    };
    return RebalanceAgent;
}(Agent));
exports.RebalanceAgent = RebalanceAgent;
