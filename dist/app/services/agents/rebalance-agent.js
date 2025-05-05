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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebalanceAgent = void 0;
var base_agent_1 = require("./base-agent");
var token_service_1 = require("../token-service");
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var RebalanceAgent = /** @class */ (function (_super) {
    __extends(RebalanceAgent, _super);
    function RebalanceAgent(hederaService) {
        var _this = _super.call(this, {
            id: 'rebalance-agent',
            type: 'rebalance',
            hederaService: hederaService,
            topics: {
                input: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
                output: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC
            }
        }) || this;
        _this.isExecuting = false;
        // Initialize token service
        _this.tokenService = new token_service_1.TokenService();
        _this.tokenDataPath = path_1.default.join(process.cwd(), 'token-data.json');
        console.log('✅ RebalanceAgent initialized with TokenService');
        return _this;
    }
    RebalanceAgent.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var proposals, proposal, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log("\uD83D\uDCE5 RebalanceAgent received message: ".concat(message.type));
                        if (!(message.type === 'RebalanceApproved' && ((_a = message.details) === null || _a === void 0 ? void 0 : _a.proposalId))) return [3 /*break*/, 7];
                        console.log("\uD83D\uDD04 Processing rebalance approval for proposal: ".concat(message.details.proposalId));
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, this.getProposals()];
                    case 2:
                        proposals = _c.sent();
                        proposal = proposals.find(function (p) { return p.id === message.details.proposalId; });
                        if (!(proposal && proposal.type === 'RebalanceProposal' && ((_b = proposal.details) === null || _b === void 0 ? void 0 : _b.newWeights))) return [3 /*break*/, 4];
                        console.log("\uD83D\uDE80 Executing rebalance for approved proposal: ".concat(proposal.id));
                        return [4 /*yield*/, this.executeRebalance(proposal)];
                    case 3:
                        _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        console.error("\u274C Could not find original proposal: ".concat(message.details.proposalId));
                        _c.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_1 = _c.sent();
                        console.error('❌ Error processing approval message:', error_1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Mock function to get proposals from message history
    RebalanceAgent.prototype.getProposals = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // This would normally retrieve proposals from the HederaService
                // For now, we'll look at the most recent messages to find proposals
                // In a real implementation, these would be stored in a database
                try {
                    // Simple example - normally this would query a real data source
                    return [2 /*return*/, [
                            {
                                id: 'prop-1',
                                type: 'RebalanceProposal',
                                proposalId: 'prop-1',
                                details: {
                                    newWeights: {
                                        'BTC': 0.5,
                                        'ETH': 0.3,
                                        'SOL': 0.2,
                                    }
                                }
                            }
                        ]];
                }
                catch (error) {
                    console.error('❌ Error fetching proposals:', error);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    RebalanceAgent.prototype.executeRebalance = function (proposal) {
        return __awaiter(this, void 0, void 0, function () {
            var currentBalances, adjustments, _i, _a, _b, token, amount, tokenId, result, burnAmount, result, executionMessage, error_2;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (this.isExecuting) {
                            console.log('❌ Already executing a rebalance, skipping...');
                            return [2 /*return*/, false];
                        }
                        this.isExecuting = true;
                        console.log("\uD83D\uDD04 Starting token rebalance execution for proposal ".concat(proposal.id, "..."));
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 11, , 12]);
                        return [4 /*yield*/, this.tokenService.getTokenBalances()];
                    case 2:
                        currentBalances = _e.sent();
                        console.log('📊 Current token balances:', currentBalances);
                        adjustments = this.tokenService.calculateAdjustments(currentBalances, proposal.details.newWeights);
                        console.log('📋 Calculated token adjustments:', adjustments);
                        _i = 0, _a = Object.entries(adjustments);
                        _e.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        _b = _a[_i], token = _b[0], amount = _b[1];
                        if (Math.abs(amount) < 1) {
                            console.log("\u23ED\uFE0F Skipping minimal adjustment for ".concat(token, ": ").concat(amount));
                            return [3 /*break*/, 7];
                        }
                        tokenId = this.tokenService.getTokenId(token);
                        if (!tokenId) {
                            console.error("\u274C Token ID not found for ".concat(token));
                            return [3 /*break*/, 7];
                        }
                        if (!(amount > 0)) return [3 /*break*/, 5];
                        console.log("\uD83D\uDFE2 Minting ".concat(amount, " ").concat(token, " tokens"));
                        return [4 /*yield*/, this.tokenService.mintTokens(token, amount)];
                    case 4:
                        result = _e.sent();
                        if (result) {
                            console.log("\u2705 Successfully minted ".concat(amount, " ").concat(token, " tokens"));
                            this.logTokenOperation(token, tokenId, 'MINT', amount, proposal.id);
                        }
                        else {
                            console.error("\u274C Failed to mint ".concat(token, " tokens"));
                        }
                        return [3 /*break*/, 7];
                    case 5:
                        if (!(amount < 0)) return [3 /*break*/, 7];
                        burnAmount = Math.abs(amount);
                        console.log("\uD83D\uDD34 Burning ".concat(burnAmount, " ").concat(token, " tokens"));
                        return [4 /*yield*/, this.tokenService.burnTokens(token, burnAmount)];
                    case 6:
                        result = _e.sent();
                        if (result) {
                            console.log("\u2705 Successfully burned ".concat(burnAmount, " ").concat(token, " tokens"));
                            this.logTokenOperation(token, tokenId, 'BURN', burnAmount, proposal.id);
                        }
                        else {
                            console.error("\u274C Failed to burn ".concat(token, " tokens"));
                        }
                        _e.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        _c = {
                            id: "exec-".concat(Date.now()),
                            type: 'RebalanceExecuted',
                            timestamp: Date.now(),
                            sender: this.id
                        };
                        _d = {
                            proposalId: proposal.id,
                            preBalances: currentBalances
                        };
                        return [4 /*yield*/, this.tokenService.getTokenBalances()];
                    case 9:
                        executionMessage = (_c.details = (_d.postBalances = _e.sent(),
                            _d.adjustments = adjustments,
                            _d.executedAt = Date.now(),
                            _d.message = "Successfully executed rebalance for proposal ".concat(proposal.id, " with ").concat(Object.keys(adjustments).length, " token adjustments"),
                            _d),
                            _c);
                        return [4 /*yield*/, this.publishHCSMessage(executionMessage)];
                    case 10:
                        _e.sent();
                        console.log("\u2705 Published execution confirmation for proposal ".concat(proposal.id));
                        this.isExecuting = false;
                        return [2 /*return*/, true];
                    case 11:
                        error_2 = _e.sent();
                        console.error('❌ Error executing rebalance:', error_2);
                        this.isExecuting = false;
                        return [2 /*return*/, false];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    // Log token operation to token-data.json
    RebalanceAgent.prototype.logTokenOperation = function (token, tokenId, type, amount, proposalId) {
        try {
            // Skip file operations in production/Vercel environment
            if (process.env.NODE_ENV !== 'development') {
                console.log("\u23ED\uFE0F Skipping token data file operations in production/serverless environment");
                console.log("\u2139\uFE0F Would have logged: ".concat(type, " operation for ").concat(token, " (").concat(amount, ") from proposal ").concat(proposalId));
                return;
            }
            // Read current token data
            var tokenData = { tokens: {}, network: "testnet" };
            if (fs_1.default.existsSync(this.tokenDataPath)) {
                var data = fs_1.default.readFileSync(this.tokenDataPath, 'utf8');
                tokenData = JSON.parse(data);
            }
            // Ensure token exists in data
            if (!tokenData.tokens[token]) {
                console.error("\u274C Token ".concat(token, " not found in token data"));
                return;
            }
            // Create transaction ID (normally this would come from HTS)
            var now = Date.now();
            var txId = "0.0.4340026@".concat(now, "/").concat(proposalId, "-").concat(type.toLowerCase(), "-").concat(token);
            // Format for Hashscan URL
            var formattedTxId = txId.replace(/\./g, '-').replace('@', '-');
            var hashscanUrl = "https://hashscan.io/testnet/transaction/".concat(formattedTxId);
            // Ensure transactions array exists
            if (!tokenData.tokens[token].transactions) {
                tokenData.tokens[token].transactions = [];
            }
            // Add transaction
            tokenData.tokens[token].transactions.push({
                type: type,
                txId: txId,
                timestamp: new Date().toISOString(),
                amount: amount,
                hashscanUrl: hashscanUrl,
                proposalId: proposalId
            });
            // Save updated token data
            fs_1.default.writeFileSync(this.tokenDataPath, JSON.stringify(tokenData, null, 2));
            console.log("\u2705 Logged ".concat(type, " operation for ").concat(token, " to token-data.json"));
        }
        catch (error) {
            console.error('❌ Error logging token operation:', error);
        }
    };
    return RebalanceAgent;
}(base_agent_1.BaseAgent));
exports.RebalanceAgent = RebalanceAgent;
