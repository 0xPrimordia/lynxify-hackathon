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
exports.hederaService = exports.HederaService = void 0;
var sdk_1 = require("@hashgraph/sdk");
var hcs_1 = require("../types/hcs");
var message_store_1 = __importDefault(require("./message-store"));
var token_service_1 = require("./token-service");
var uuid_1 = require("uuid");
// HCS Topic IDs from the spec
var TOPICS = {
    GOVERNANCE_PROPOSALS: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC || '',
    MARKET_PRICE_FEED: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC || '',
    AGENT_ACTIONS: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC || ''
};
// Validate environment variables unless bypassed (for initialization)
if (process.env.BYPASS_TOPIC_CHECK !== 'true') {
    Object.entries(TOPICS).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        if (!value) {
            throw new Error("Missing required environment variable for ".concat(key, " topic"));
        }
    });
}
// Type-safe topic IDs after validation
var TOPIC_IDS = {
    GOVERNANCE_PROPOSALS: TOPICS.GOVERNANCE_PROPOSALS,
    MARKET_PRICE_FEED: TOPICS.MARKET_PRICE_FEED,
    AGENT_ACTIONS: TOPICS.AGENT_ACTIONS
};
// Agent configuration from the spec
var AGENTS = {
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
var HederaService = /** @class */ (function () {
    function HederaService() {
        var _this = this;
        this.subscriptions = new Map();
        this.lastPrices = new Map();
        this.messageHandlers = new Map();
        // Message handlers
        this.handlePriceFeedMessage = function (message) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (message.type === 'PriceUpdate') {
                    // Store the last price for calculating changes
                    this.lastPrices.set(message.details.tokenId || '', message.details.price || 0);
                    console.log('Price update received:', message);
                }
                return [2 /*return*/];
            });
        }); };
        this.handleGovernanceMessage = function (message) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (message.type === 'RebalanceProposal') {
                    // Handle rebalance proposal
                    console.log('Rebalance proposal received:', message);
                }
                else if (message.type === 'RebalanceApproved') {
                    // Handle approved proposal
                    console.log('Rebalance approved:', message);
                }
                return [2 /*return*/];
            });
        }); };
        this.handleAgentMessage = function (message) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (message.type === 'RebalanceExecuted') {
                    // Handle rebalance execution
                    console.log('Rebalance executed:', message);
                }
                return [2 /*return*/];
            });
        }); };
        console.log('🚀 HEDERA: Initializing HederaService with REAL Hedera network...');
        // Check if environment variables are properly set
        var operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
        var operatorKey = process.env.OPERATOR_KEY;
        // Validate critical environment variables
        var missingVars = [];
        if (!operatorId)
            missingVars.push('NEXT_PUBLIC_OPERATOR_ID');
        if (!operatorKey)
            missingVars.push('OPERATOR_KEY');
        if (missingVars.length > 0) {
            var errorMsg = "CRITICAL ERROR: Missing required environment variables: ".concat(missingVars.join(', '));
            console.error("\u274C HEDERA ERROR: ".concat(errorMsg));
            throw new Error(errorMsg);
        }
        // Initialize Hedera client with testnet credentials
        try {
            console.log('🔄 HEDERA: Creating client for testnet with operator:', operatorId);
            this.client = sdk_1.Client.forTestnet();
            console.log('🔄 HEDERA: Setting operator credentials...');
            this.client.setOperator(sdk_1.AccountId.fromString(operatorId), sdk_1.PrivateKey.fromString(operatorKey));
            console.log('✅ HEDERA: Successfully initialized client with REAL Hedera testnet');
        }
        catch (error) {
            console.error('❌ HEDERA ERROR: Failed to initialize Hedera client:', error);
            throw error;
        }
        try {
            this.tokenService = new token_service_1.TokenService(); // Initialize token service
            console.log('✅ HederaService initialized successfully!');
        }
        catch (error) {
            console.error('❌ Error initializing HederaService:', error);
            throw error;
        }
    }
    // Create HCS topics
    HederaService.prototype.createGovernanceTopic = function () {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, response, receipt, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        transaction = new sdk_1.TopicCreateTransaction()
                            .setTopicMemo('Governance Proposals Topic');
                        return [4 /*yield*/, transaction.execute(this.client)];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.getReceipt(this.client)];
                    case 2:
                        receipt = _a.sent();
                        if (!receipt.topicId) {
                            throw new Error('Failed to create governance topic');
                        }
                        return [2 /*return*/, receipt.topicId.toString()];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error creating governance topic:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    HederaService.prototype.createAgentTopic = function () {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, response, receipt, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        transaction = new sdk_1.TopicCreateTransaction()
                            .setTopicMemo('Agent Actions Topic');
                        return [4 /*yield*/, transaction.execute(this.client)];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.getReceipt(this.client)];
                    case 2:
                        receipt = _a.sent();
                        if (!receipt.topicId) {
                            throw new Error('Failed to create agent topic');
                        }
                        return [2 /*return*/, receipt.topicId.toString()];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error creating agent topic:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    HederaService.prototype.createPriceFeedTopic = function () {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, response, receipt, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        transaction = new sdk_1.TopicCreateTransaction()
                            .setTopicMemo('Price Feed Topic');
                        return [4 /*yield*/, transaction.execute(this.client)];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.getReceipt(this.client)];
                    case 2:
                        receipt = _a.sent();
                        if (!receipt.topicId) {
                            throw new Error('Failed to create price feed topic');
                        }
                        return [2 /*return*/, receipt.topicId.toString()];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error creating price feed topic:', error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Get messages from a topic using the Mirror Node (more reliable for demos)
    HederaService.prototype.getTopicMessages = function (topicId) {
        return __awaiter(this, void 0, void 0, function () {
            var messages;
            return __generator(this, function (_a) {
                console.log("\uD83D\uDD0D HEDERA: Getting messages from Mirror Node for topic ".concat(topicId, "..."));
                try {
                    messages = message_store_1.default.getMessages(topicId);
                    console.log("\u2705 HEDERA: Retrieved ".concat(messages.length, " messages for topic ").concat(topicId));
                    return [2 /*return*/, messages];
                }
                catch (error) {
                    console.error("\u274C HEDERA ERROR: Error getting topic messages from ".concat(topicId, ":"), error);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    // HCS Message Publishing
    HederaService.prototype.publishHCSMessage = function (topicId, message) {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, parsedTopicId, response, txId, error_4, receipt, error_5, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        console.log("\uD83D\uDD04 HEDERA: Publishing REAL message to HCS topic ".concat(topicId, ":"), {
                            messageType: message.type,
                            messageId: message.id,
                            timestamp: new Date(message.timestamp).toISOString(),
                            sender: message.sender,
                        });
                        console.log('📝 HEDERA: Full message content:', JSON.stringify(message));
                        // Validate topic ID
                        if (!topicId || topicId.trim() === '') {
                            console.error("\u274C HEDERA ERROR: Invalid topic ID: \"".concat(topicId, "\""));
                            throw new Error("Invalid topic ID: \"".concat(topicId, "\""));
                        }
                        console.log("\uD83D\uDD04 HEDERA: Creating TopicMessageSubmitTransaction for topic ".concat(topicId, "..."));
                        transaction = void 0;
                        try {
                            parsedTopicId = sdk_1.TopicId.fromString(topicId);
                            console.log("\u2705 HEDERA: Topic ID is valid: ".concat(parsedTopicId.toString()));
                            transaction = new sdk_1.TopicMessageSubmitTransaction()
                                .setTopicId(parsedTopicId)
                                .setMessage(JSON.stringify(message));
                        }
                        catch (error) {
                            console.error("\u274C HEDERA ERROR: Failed to create transaction for topic ".concat(topicId, ":"), error);
                            throw error;
                        }
                        console.log("\uD83D\uDD04 HEDERA: Executing transaction for topic ".concat(topicId, "..."));
                        response = void 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, transaction.execute(this.client)];
                    case 2:
                        response = _a.sent();
                        txId = "unknown";
                        try {
                            txId = response.toString().split('@')[1] || response.toString();
                        }
                        catch (err) {
                            console.warn("\u26A0\uFE0F Could not parse transaction ID cleanly: ".concat(err));
                            txId = response.toString();
                        }
                        console.log("======================================================");
                        console.log("\u2705 HEDERA: Transaction executed for topic ".concat(topicId));
                        console.log("\uD83D\uDD0D TRANSACTION ID: ".concat(txId));
                        console.log("\uD83D\uDD17 VERIFY ON HASHSCAN: https://hashscan.io/testnet/transaction/".concat(txId));
                        console.log("======================================================");
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error("\u274C HEDERA ERROR: Transaction execution failed for topic ".concat(topicId, ":"), error_4);
                        throw error_4;
                    case 4:
                        console.log("\uD83D\uDD04 HEDERA: Getting receipt for topic ".concat(topicId, " transaction..."));
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, response.getReceipt(this.client)];
                    case 6:
                        receipt = _a.sent();
                        console.log("\u2705 HEDERA: Message successfully published to real HCS topic ".concat(topicId), {
                            receipt: JSON.stringify(receipt)
                        });
                        // Store message in the global message store
                        message_store_1.default.addMessage(topicId, message);
                        return [3 /*break*/, 8];
                    case 7:
                        error_5 = _a.sent();
                        console.error("\u274C HEDERA ERROR: Failed to get receipt for topic ".concat(topicId, ":"), error_5);
                        // Don't throw here - the message might still have been published
                        console.log("\u26A0\uFE0F HEDERA: Message may still have been published despite receipt error");
                        // Still store the message in global message store
                        message_store_1.default.addMessage(topicId, message);
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_6 = _a.sent();
                        console.error("\u274C HEDERA ERROR: Error publishing real HCS message:", error_6);
                        throw error_6;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    // HCS Message Subscription
    HederaService.prototype.subscribeToTopic = function (topicId, onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var topicIdObj, subscription;
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    // Validate topic ID
                    if (!topicId || topicId === 'undefined' || topicId.trim() === '') {
                        console.error("\u274C HEDERA ERROR: Invalid topic ID: \"".concat(topicId, "\""));
                        throw new Error("Invalid topic ID: \"".concat(topicId, "\""));
                    }
                    topicIdObj = sdk_1.TopicId.fromString(topicId);
                    console.log("\uD83D\uDD04 HEDERA: Subscribing to topic: ".concat(topicIdObj.toString()));
                    // Check if we're already subscribed
                    if (this.subscriptions.has(topicId)) {
                        console.log("\u2139\uFE0F HEDERA: Already subscribed to topic: ".concat(topicId));
                        // Add the new message handler
                        if (!this.messageHandlers.has(topicId)) {
                            this.messageHandlers.set(topicId, []);
                        }
                        this.messageHandlers.get(topicId).push(onMessage);
                        return [2 /*return*/];
                    }
                    // Register the message handler
                    if (!this.messageHandlers.has(topicId)) {
                        this.messageHandlers.set(topicId, []);
                    }
                    this.messageHandlers.get(topicId).push(onMessage);
                    subscription = new sdk_1.TopicMessageQuery()
                        .setTopicId(topicIdObj)
                        .subscribe(this.client, function (message, error) {
                        var _a;
                        if (error) {
                            console.error("\u274C HEDERA ERROR: Error in subscription to topic ".concat(topicId, ":"), error);
                            return;
                        }
                        if (!message) {
                            console.warn("\u26A0\uFE0F HEDERA: Received null message from topic ".concat(topicId));
                            return;
                        }
                        try {
                            var messageAsString = Buffer.from(message.contents).toString();
                            var parsedMessage_1 = JSON.parse(messageAsString);
                            if ((0, hcs_1.isValidHCSMessage)(parsedMessage_1)) {
                                console.log("\u2705 HEDERA: Received valid message from topic ".concat(topicId));
                                // Store message in the global message store
                                message_store_1.default.addMessage(topicId, parsedMessage_1);
                                // Notify all handlers for this topic
                                (_a = _this.messageHandlers.get(topicId)) === null || _a === void 0 ? void 0 : _a.forEach(function (handler) {
                                    handler(parsedMessage_1);
                                });
                            }
                            else {
                                console.error("\u274C HEDERA: Received invalid message format from topic ".concat(topicId));
                            }
                        }
                        catch (error) {
                            console.error("\u274C HEDERA ERROR: Failed to parse message from topic ".concat(topicId, ":"), error);
                        }
                    }, function (message) {
                        var _a;
                        try {
                            var messageAsString = Buffer.from(message.contents).toString();
                            var parsedMessage_2 = JSON.parse(messageAsString);
                            if ((0, hcs_1.isValidHCSMessage)(parsedMessage_2)) {
                                console.log("\u2705 HEDERA: Received valid message from topic ".concat(topicId));
                                // Store message in the global message store
                                message_store_1.default.addMessage(topicId, parsedMessage_2);
                                // Notify all handlers for this topic
                                (_a = _this.messageHandlers.get(topicId)) === null || _a === void 0 ? void 0 : _a.forEach(function (handler) {
                                    handler(parsedMessage_2);
                                });
                            }
                            else {
                                console.error("\u274C HEDERA: Received invalid message format from topic ".concat(topicId));
                            }
                        }
                        catch (error) {
                            console.error("\u274C HEDERA ERROR: Failed to parse message from topic ".concat(topicId, ":"), error);
                        }
                    });
                    this.subscriptions.set(topicId, subscription);
                    console.log("\u2705 HEDERA: Successfully subscribed to topic ".concat(topicId));
                }
                catch (error) {
                    console.error("\u274C HEDERA ERROR: Failed to subscribe to topic ".concat(topicId, ":"), error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    // Unsubscribe from topic
    HederaService.prototype.unsubscribeFromTopic = function (topicId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                subscription = this.subscriptions.get(topicId);
                if (subscription) {
                    subscription.unsubscribe();
                    this.subscriptions.delete(topicId);
                    this.messageHandlers.delete(topicId);
                }
                return [2 /*return*/];
            });
        });
    };
    // Initialize topics if they don't exist
    HederaService.prototype.initializeTopics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        // Log HCS topic configuration
                        console.log('📋 HEDERA: HCS topic configuration for REAL network:', {
                            governanceTopic: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
                            priceFeedTopic: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC,
                            agentTopic: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC
                        });
                        // Subscribe to all topics
                        return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC, this.handleGovernanceMessage.bind(this))];
                    case 1:
                        // Subscribe to all topics
                        _a.sent();
                        return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC, this.handlePriceFeedMessage.bind(this))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC, this.handleAgentMessage.bind(this))];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_7 = _a.sent();
                        console.error('Error initializing topics:', error_7);
                        throw error_7;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Agent Functions
    HederaService.prototype.processPriceUpdate = function (price, tokenId) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        message = {
                            id: "price-".concat(Date.now()),
                            type: 'PriceUpdate',
                            timestamp: Date.now(),
                            sender: AGENTS.PRICE_FEED.id,
                            details: {
                                tokenId: tokenId,
                                price: price,
                                source: 'price-feed-agent'
                            }
                        };
                        return [4 /*yield*/, this.publishHCSMessage(TOPIC_IDS.MARKET_PRICE_FEED, message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    HederaService.prototype.assessRisk = function (priceChange, tokenId) {
        return __awaiter(this, void 0, void 0, function () {
            var riskLevel, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        riskLevel = Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.high ? 'high' :
                            Math.abs(priceChange) >= AGENTS.RISK_ASSESSMENT.riskLevels.medium ? 'medium' :
                                'low';
                        message = {
                            id: "risk-".concat(Date.now()),
                            type: 'RiskAlert',
                            timestamp: Date.now(),
                            sender: AGENTS.RISK_ASSESSMENT.id,
                            details: {
                                severity: riskLevel,
                                description: "Price deviation of ".concat(priceChange, "% detected for ").concat(tokenId),
                                affectedTokens: [tokenId],
                                metrics: {
                                    priceChange: priceChange
                                }
                            }
                        };
                        return [4 /*yield*/, this.publishHCSMessage(TOPIC_IDS.GOVERNANCE_PROPOSALS, message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Propose a rebalance
    HederaService.prototype.proposeRebalance = function (newWeights, executeAfter, quorum, trigger, justification) {
        return __awaiter(this, void 0, void 0, function () {
            var messageId, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🔄 HEDERA: Creating rebalance proposal message with real HCS:', {
                            newWeightsTokens: Object.keys(newWeights),
                            executeAfter: new Date(executeAfter).toISOString(),
                            quorum: quorum,
                            trigger: trigger,
                            justificationLength: justification === null || justification === void 0 ? void 0 : justification.length
                        });
                        messageId = "prop-".concat(Date.now());
                        message = {
                            id: messageId,
                            type: 'RebalanceProposal',
                            timestamp: Date.now(),
                            sender: AGENTS.REBALANCE.id,
                            details: {
                                newWeights: newWeights,
                                executeAfter: executeAfter,
                                quorum: quorum,
                                trigger: trigger,
                                message: justification || 'Proposed rebalance to maintain target weights'
                            }
                        };
                        console.log("\uD83D\uDCDD HEDERA: Created proposal message with ID ".concat(messageId), message);
                        return [4 /*yield*/, this.publishHCSMessage(TOPIC_IDS.GOVERNANCE_PROPOSALS, message)];
                    case 1:
                        _a.sent();
                        console.log('✅ HEDERA: Successfully published real proposal to governance topic');
                        return [2 /*return*/];
                }
            });
        });
    };
    // Approve a rebalance proposal
    HederaService.prototype.approveRebalance = function (proposalId) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        message = {
                            id: "approval-".concat(Date.now()),
                            type: 'RebalanceApproved',
                            timestamp: Date.now(),
                            sender: AGENTS.REBALANCE.id,
                            details: {
                                proposalId: proposalId,
                                approvedAt: Date.now()
                            }
                        };
                        return [4 /*yield*/, this.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC, message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Get current portfolio weights (now can use real token data)
    HederaService.prototype.getCurrentPortfolioWeights = function () {
        try {
            // For demo purposes, return hardcoded weights if token data isn't available
            return { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 };
        }
        catch (error) {
            console.error('❌ Error getting current portfolio weights:', error);
            return { 'BTC': 0.4, 'ETH': 0.4, 'SOL': 0.2 };
        }
    };
    // Execute rebalance using real token operations
    HederaService.prototype.executeRebalance = function (proposalId, newWeights) {
        return __awaiter(this, void 0, void 0, function () {
            var currentBalances, adjustments, _i, _a, _b, asset, adjustment, updatedBalances, executionMessage, error_8;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 10, , 11]);
                        console.log("\uD83D\uDD04 HEDERA: Executing rebalance for proposal: ".concat(proposalId), newWeights);
                        return [4 /*yield*/, this.tokenService.getTokenBalances()];
                    case 1:
                        currentBalances = _c.sent();
                        console.log("\uD83D\uDD0D HEDERA: Current balances:", currentBalances);
                        adjustments = this.tokenService.calculateAdjustments(currentBalances, newWeights);
                        console.log("\uD83D\uDD0D HEDERA: Calculated adjustments:", adjustments);
                        _i = 0, _a = Object.entries(adjustments);
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        _b = _a[_i], asset = _b[0], adjustment = _b[1];
                        if (!(adjustment > 0)) return [3 /*break*/, 4];
                        // Mint additional tokens
                        return [4 /*yield*/, this.tokenService.mintTokens(asset, adjustment)];
                    case 3:
                        // Mint additional tokens
                        _c.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        if (!(adjustment < 0)) return [3 /*break*/, 6];
                        // Burn excess tokens
                        return [4 /*yield*/, this.tokenService.burnTokens(asset, Math.abs(adjustment))];
                    case 5:
                        // Burn excess tokens
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [4 /*yield*/, this.tokenService.getTokenBalances()];
                    case 8:
                        updatedBalances = _c.sent();
                        console.log("\uD83D\uDD0D HEDERA: Updated balances:", updatedBalances);
                        executionMessage = {
                            type: 'RebalanceExecuted',
                            id: (0, uuid_1.v4)(),
                            timestamp: Date.now(),
                            sender: process.env.NEXT_PUBLIC_OPERATOR_ID || 'unknown',
                            details: {
                                proposalId: proposalId,
                                preBalances: currentBalances,
                                postBalances: updatedBalances,
                                executedAt: Date.now(),
                                message: "Rebalance executed based on approval from governance process."
                            }
                        };
                        // Publish execution confirmation to agent topic
                        return [4 /*yield*/, this.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC, executionMessage)];
                    case 9:
                        // Publish execution confirmation to agent topic
                        _c.sent();
                        console.log("\u2705 HEDERA: Successfully executed rebalance for proposal ".concat(proposalId));
                        return [3 /*break*/, 11];
                    case 10:
                        error_8 = _c.sent();
                        console.error("\u274C HEDERA ERROR: Failed to execute rebalance for proposal ".concat(proposalId, ":"), error_8);
                        throw error_8;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    // Initialize agent subscriptions
    HederaService.prototype.initializeAgents = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Price Feed Agent
                    return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC, function (message) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!(message.type === 'PriceUpdate')) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this.processPriceUpdate(message.details.price || 0, message.details.tokenId || '')];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        // Price Feed Agent
                        _a.sent();
                        // Risk Assessment Agent
                        return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC, function (message) { return __awaiter(_this, void 0, void 0, function () {
                                var lastPrice, priceChange;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(message.type === 'PriceUpdate')) return [3 /*break*/, 2];
                                            lastPrice = this.lastPrices.get(message.details.tokenId || '');
                                            if (!lastPrice) return [3 /*break*/, 2];
                                            priceChange = ((message.details.price || 0) - lastPrice) / lastPrice * 100;
                                            if (!(Math.abs(priceChange) >= AGENTS.PRICE_FEED.threshold)) return [3 /*break*/, 2];
                                            return [4 /*yield*/, this.assessRisk(priceChange, message.details.tokenId || '')];
                                        case 1:
                                            _a.sent();
                                            _a.label = 2;
                                        case 2: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        // Risk Assessment Agent
                        _a.sent();
                        // Rebalance Agent
                        return [4 /*yield*/, this.subscribeToTopic(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC, function (message) { return __awaiter(_this, void 0, void 0, function () {
                                var proposal;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(message.type === 'RebalanceApproved')) return [3 /*break*/, 3];
                                            return [4 /*yield*/, this.getProposal(message.details.proposalId || '')];
                                        case 1:
                                            proposal = _a.sent();
                                            if (!((proposal === null || proposal === void 0 ? void 0 : proposal.type) === 'RebalanceProposal')) return [3 /*break*/, 3];
                                            return [4 /*yield*/, this.executeRebalance(message.details.proposalId || '', proposal.details.newWeights || {})];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        // Rebalance Agent
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Helper function to get proposal details
    HederaService.prototype.getProposal = function (proposalId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // TODO: Implement proposal retrieval from HCS
                return [2 /*return*/, null];
            });
        });
    };
    return HederaService;
}());
exports.HederaService = HederaService;
// Create singleton instance
exports.hederaService = new HederaService();
