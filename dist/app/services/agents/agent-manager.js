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
exports.AgentManager = void 0;
var hedera_1 = require("../hedera");
var price_feed_agent_1 = require("./price-feed-agent");
var risk_assessment_agent_1 = require("./risk-assessment-agent");
var rebalance_agent_1 = require("./rebalance-agent");
var AgentManager = /** @class */ (function () {
    function AgentManager() {
        this.runningAgents = new Set();
        this.hederaService = new hedera_1.HederaService();
        this.priceFeedAgent = new price_feed_agent_1.PriceFeedAgent(this.hederaService);
        this.riskAssessmentAgent = new risk_assessment_agent_1.RiskAssessmentAgent(this.hederaService);
        this.rebalanceAgent = new rebalance_agent_1.RebalanceAgent(this.hederaService);
    }
    AgentManager.prototype.startAgent = function (agentId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.runningAgents.has(agentId)) {
                            throw new Error("Agent ".concat(agentId, " is already running"));
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        _a = agentId;
                        switch (_a) {
                            case 'price-feed': return [3 /*break*/, 2];
                            case 'risk-assessment': return [3 /*break*/, 4];
                            case 'rebalance': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, this.priceFeedAgent.start()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 4: return [4 /*yield*/, this.riskAssessmentAgent.start()];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 6: return [4 /*yield*/, this.rebalanceAgent.start()];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 8: throw new Error("Unknown agent: ".concat(agentId));
                    case 9:
                        this.runningAgents.add(agentId);
                        console.log("Agent ".concat(agentId, " started successfully"));
                        return [3 /*break*/, 11];
                    case 10:
                        error_1 = _b.sent();
                        console.error("Error starting agent ".concat(agentId, ":"), error_1);
                        throw error_1;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    AgentManager.prototype.stopAgent = function (agentId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.runningAgents.has(agentId)) {
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        _a = agentId;
                        switch (_a) {
                            case 'price-feed': return [3 /*break*/, 2];
                            case 'risk-assessment': return [3 /*break*/, 4];
                            case 'rebalance': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, this.priceFeedAgent.stop()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 4: return [4 /*yield*/, this.riskAssessmentAgent.stop()];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 6: return [4 /*yield*/, this.rebalanceAgent.stop()];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 8: throw new Error("Unknown agent: ".concat(agentId));
                    case 9:
                        this.runningAgents.delete(agentId);
                        console.log("Agent ".concat(agentId, " stopped successfully"));
                        return [3 /*break*/, 11];
                    case 10:
                        error_2 = _b.sent();
                        console.error("Error stopping agent ".concat(agentId, ":"), error_2);
                        throw error_2;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    AgentManager.prototype.getAgentStatus = function (agentId) {
        if (!this.runningAgents.has(agentId)) {
            return 'stopped';
        }
        try {
            switch (agentId) {
                case 'price-feed':
                    return this.runningAgents.has('price-feed') ? 'running' : 'error';
                case 'risk-assessment':
                    return this.runningAgents.has('risk-assessment') ? 'running' : 'error';
                case 'rebalance':
                    return this.runningAgents.has('rebalance') ? 'running' : 'error';
                default:
                    return 'error';
            }
        }
        catch (error) {
            console.error("Error getting status for agent ".concat(agentId, ":"), error);
            return 'error';
        }
    };
    AgentManager.prototype.getAllAgentStatuses = function () {
        return {
            'price-feed': this.getAgentStatus('price-feed'),
            'risk-assessment': this.getAgentStatus('risk-assessment'),
            'rebalance': this.getAgentStatus('rebalance')
        };
    };
    AgentManager.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.hederaService.initializeTopics()];
                    case 1:
                        _a.sent();
                        console.log('AgentManager started successfully');
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error starting AgentManager:', error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    AgentManager.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, agentId, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        _i = 0, _a = this.runningAgents;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        agentId = _a[_i];
                        return [4 /*yield*/, this.stopAgent(agentId)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        console.log('AgentManager stopped successfully');
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _b.sent();
                        console.error('Error stopping AgentManager:', error_4);
                        throw error_4;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return AgentManager;
}());
exports.AgentManager = AgentManager;
