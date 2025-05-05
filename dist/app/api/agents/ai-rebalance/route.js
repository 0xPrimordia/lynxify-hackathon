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
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
var server_1 = require("next/server");
var ai_rebalance_agent_1 = require("@/app/services/agents/ai-rebalance-agent");
var hedera_1 = require("@/app/services/hedera");
var token_service_1 = require("@/app/services/token-service");
// Mock market data for demo purposes - UPDATED with correct token symbols
var marketData = {
    prices: {
        BTC: 65000,
        ETH: 3000,
        SOL: 150,
        'Lynxify-Index': 10
    },
    priceChanges: {
        BTC: 2.5,
        ETH: -1.2,
        SOL: 5.8,
        'Lynxify-Index': 1.5
    },
    volumes: {
        BTC: 50000000,
        ETH: 30000000,
        SOL: 10000000,
        'Lynxify-Index': 1000000
    },
    volatility: {
        BTC: 0.05,
        ETH: 0.07,
        SOL: 0.09,
        'Lynxify-Index': 0.03
    }
};
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var body, proposal, tokenService, validTokens, filteredWeights, totalWeight, _i, _a, _b, token, weight, _c, _d, token, executeAfter, quorum, trigger, error_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, request.json()];
                case 1:
                    body = _e.sent();
                    return [4 /*yield*/, ai_rebalance_agent_1.aiRebalanceAgent.generateRebalanceProposal()];
                case 2:
                    proposal = _e.sent();
                    if (!proposal.success || !proposal.newWeights) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                message: proposal.message || 'Failed to generate rebalance proposal'
                            }, { status: 400 })];
                    }
                    tokenService = new token_service_1.TokenService();
                    validTokens = Object.keys(tokenService.getAllTokenIds());
                    filteredWeights = {};
                    totalWeight = 0;
                    for (_i = 0, _a = Object.entries(proposal.newWeights); _i < _a.length; _i++) {
                        _b = _a[_i], token = _b[0], weight = _b[1];
                        if (validTokens.includes(token)) {
                            filteredWeights[token] = weight;
                            totalWeight += weight;
                        }
                    }
                    // Second pass: normalize weights to sum to 1.0
                    for (_c = 0, _d = Object.keys(filteredWeights); _c < _d.length; _c++) {
                        token = _d[_c];
                        filteredWeights[token] = filteredWeights[token] / totalWeight;
                    }
                    console.log('Filtered weights to include only valid tokens:', filteredWeights);
                    executeAfter = body.executeAfter || Date.now() + (24 * 60 * 60 * 1000);
                    quorum = body.quorum || 5000;
                    trigger = body.trigger || 'scheduled';
                    // Submit proposal to HCS
                    return [4 /*yield*/, hedera_1.hederaService.proposeRebalance(filteredWeights, executeAfter, quorum, trigger, proposal.analysis || 'AI-generated rebalance proposal for optimal asset allocation')];
                case 3:
                    // Submit proposal to HCS
                    _e.sent();
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            message: 'Proposal submitted to HCS',
                            proposal: {
                                newWeights: filteredWeights,
                                executeAfter: executeAfter,
                                quorum: quorum,
                                trigger: trigger,
                                analysis: proposal.analysis
                            }
                        })];
                case 4:
                    error_1 = _e.sent();
                    console.error('Error in AI rebalance proposal:', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            message: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        }, { status: 500 })];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Helper function to submit proposal to HCS
function proposeRebalanceToHCS(newWeights, analysis) {
    return __awaiter(this, void 0, void 0, function () {
        var executeAfter, quorum, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    executeAfter = Date.now() + (24 * 60 * 60 * 1000);
                    quorum = 5000;
                    return [4 /*yield*/, hedera_1.hederaService.proposeRebalance(newWeights, executeAfter, quorum, 'scheduled', analysis)];
                case 1:
                    result = _a.sent();
                    console.log('Proposal submitted to HCS');
                    return [2 /*return*/, result];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error submitting proposal to HCS:', error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
