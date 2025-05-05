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
exports.useProposeRebalance = exports.useExecuteRebalance = exports.useApproveProposal = exports.useProposals = exports.useHCSMessages = void 0;
var react_query_1 = require("@tanstack/react-query");
// Fetch HCS messages
var useHCSMessages = function () {
    return (0, react_query_1.useQuery)({
        queryKey: ['hcs-messages'],
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, data, validMessages, uniqueMessages;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('📥 FETCH: Requesting HCS messages from API...');
                        return [4 /*yield*/, fetch('/api/hcs/messages')];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            console.error('❌ FETCH ERROR: Failed to fetch HCS messages:', response.statusText);
                            throw new Error('Failed to fetch HCS messages');
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        // Ensure the response is an array
                        if (!Array.isArray(data)) {
                            console.error('❌ FETCH ERROR: Expected array response, got:', typeof data);
                            return [2 /*return*/, []];
                        }
                        validMessages = data.filter(function (msg) {
                            var isValid = msg && typeof msg === 'object' && msg.id && msg.type && msg.timestamp;
                            if (!isValid) {
                                console.error('❌ FETCH ERROR: Invalid message structure:', msg);
                            }
                            return isValid;
                        });
                        uniqueMessages = Array.from(new Map(validMessages.map(function (msg) { return [msg.id, msg]; })).values());
                        console.log("\u2705 FETCH: Received ".concat(uniqueMessages.length, " valid unique HCS messages"));
                        return [2 /*return*/, uniqueMessages];
                }
            });
        }); },
        refetchInterval: 10000, // Reduce polling frequency to 10 seconds
        staleTime: 5000, // Consider data fresh for 5 seconds
    });
};
exports.useHCSMessages = useHCSMessages;
// Convert HCS messages to proposals
var useProposals = function () {
    var _a = (0, exports.useHCSMessages)(), messages = _a.data, isLoading = _a.isLoading, error = _a.error;
    // Track proposals and their statuses
    var proposalMap = new Map();
    if (messages) {
        // First pass: collect all RebalanceProposal messages
        messages.filter(function (msg) { return msg.type === 'RebalanceProposal'; }).forEach(function (msg) {
            var _a, _b;
            proposalMap.set(msg.id, {
                id: msg.id,
                type: 'RebalanceProposal',
                status: 'pending',
                timestamp: msg.timestamp,
                sender: msg.sender || 'Unknown',
                details: {
                    newWeights: ((_a = msg.details) === null || _a === void 0 ? void 0 : _a.newWeights) || {},
                    trigger: (_b = msg.details) === null || _b === void 0 ? void 0 : _b.trigger,
                    executedAt: undefined
                },
                votes: { for: 0, against: 0, total: 0 }
            });
        });
        // Second pass: update with RebalanceApproved messages
        messages.filter(function (msg) { return msg.type === 'RebalanceApproved'; }).forEach(function (msg) {
            var _a;
            var proposalId = (_a = msg.details) === null || _a === void 0 ? void 0 : _a.proposalId;
            if (proposalId && proposalMap.has(proposalId)) {
                var proposal = proposalMap.get(proposalId);
                if (proposal) {
                    proposal.status = 'approved';
                    if (msg.votes) {
                        proposal.votes = msg.votes;
                    }
                }
            }
        });
        // Third pass: update with RebalanceExecuted messages
        messages.filter(function (msg) { return msg.type === 'RebalanceExecuted'; }).forEach(function (msg) {
            var _a, _b;
            var proposalId = (_a = msg.details) === null || _a === void 0 ? void 0 : _a.proposalId;
            if (proposalId && proposalMap.has(proposalId)) {
                var proposal = proposalMap.get(proposalId);
                if (proposal) {
                    proposal.status = 'executed';
                    proposal.details.executedAt = (_b = msg.details) === null || _b === void 0 ? void 0 : _b.executedAt;
                }
            }
        });
    }
    // Convert map to array
    var proposals = Array.from(proposalMap.values());
    console.log("\u2705 PROPOSALS: Processed ".concat(proposals.length, " proposals from ").concat((messages === null || messages === void 0 ? void 0 : messages.length) || 0, " messages"));
    return {
        data: proposals,
        isLoading: isLoading,
        error: error
    };
};
exports.useProposals = useProposals;
// Approve a rebalance proposal
var useApproveProposal = function () {
    var queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (proposalId) { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch('/api/hcs/messages', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ proposalId: proposalId }),
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error('Failed to approve proposal');
                        }
                        return [2 /*return*/, proposalId];
                }
            });
        }); },
        onSuccess: function () {
            // Invalidate and refetch HCS messages
            queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
        },
    });
};
exports.useApproveProposal = useApproveProposal;
// Execute a rebalance
var useExecuteRebalance = function () {
    var queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var response;
            var proposalId = _b.proposalId, newWeights = _b.newWeights;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, fetch('/api/hcs/messages', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ proposalId: proposalId, newWeights: newWeights, action: 'execute' }),
                        })];
                    case 1:
                        response = _c.sent();
                        if (!response.ok) {
                            throw new Error('Failed to execute rebalance');
                        }
                        return [2 /*return*/, { proposalId: proposalId, newWeights: newWeights }];
                }
            });
        }); },
        onSuccess: function () {
            // Invalidate and refetch HCS messages
            queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
        },
    });
};
exports.useExecuteRebalance = useExecuteRebalance;
// Propose a rebalance
var useProposeRebalance = function () {
    var queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var response;
            var newWeights = _b.newWeights, executeAfter = _b.executeAfter, quorum = _b.quorum, trigger = _b.trigger, justification = _b.justification;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, fetch('/api/hcs/messages', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                action: 'propose',
                                newWeights: newWeights,
                                executeAfter: executeAfter,
                                quorum: quorum,
                                trigger: trigger,
                                justification: justification
                            }),
                        })];
                    case 1:
                        response = _c.sent();
                        if (!response.ok) {
                            throw new Error('Failed to propose rebalance');
                        }
                        return [2 /*return*/, { newWeights: newWeights, executeAfter: executeAfter, quorum: quorum, trigger: trigger, justification: justification }];
                }
            });
        }); },
        onSuccess: function () {
            // Invalidate and refetch HCS messages
            queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
        },
    });
};
exports.useProposeRebalance = useProposeRebalance;
