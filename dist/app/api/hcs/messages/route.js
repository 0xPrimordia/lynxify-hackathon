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
exports.runtime = exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
var server_1 = require("next/server");
var hedera_1 = require("@/app/services/hedera");
var message_store_1 = __importDefault(require("@/app/services/message-store"));
// Track whether we've subscribed to topics
var initializedTopics = false;
// Only run on server, not during build
exports.dynamic = 'force-dynamic';
exports.runtime = 'nodejs';
// Ensures subscription is only attempted once per server instance
function initializeSubscriptions() {
    return __awaiter(this, void 0, void 0, function () {
        var governanceTopicId, agentTopicId, priceFeedTopicId, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Skip subscriptions during build time
                    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
                        console.log('ℹ️ API: Running in production build, deferring subscriptions to runtime');
                        return [2 /*return*/];
                    }
                    if (initializedTopics) {
                        console.log('ℹ️ API: Topics already initialized, skipping subscription');
                        return [2 /*return*/];
                    }
                    console.log('🔄 API: Initializing HCS topic subscriptions');
                    governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
                    agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
                    priceFeedTopicId = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;
                    if (!governanceTopicId || !agentTopicId || !priceFeedTopicId) {
                        console.error('❌ API: HCS topic IDs not configured');
                        throw new Error('HCS topic IDs not configured');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    // Subscribe to governance topic
                    return [4 /*yield*/, hedera_1.hederaService.subscribeToTopic(governanceTopicId, function (message) {
                            console.log("\u2705 API: Received message from governance topic: ".concat(message.type));
                            message_store_1.default.addMessage(governanceTopicId, message);
                        })];
                case 2:
                    // Subscribe to governance topic
                    _a.sent();
                    // Subscribe to agent topic
                    return [4 /*yield*/, hedera_1.hederaService.subscribeToTopic(agentTopicId, function (message) {
                            console.log("\u2705 API: Received message from agent topic: ".concat(message.type));
                            message_store_1.default.addMessage(agentTopicId, message);
                        })];
                case 3:
                    // Subscribe to agent topic
                    _a.sent();
                    // Subscribe to price feed topic
                    return [4 /*yield*/, hedera_1.hederaService.subscribeToTopic(priceFeedTopicId, function (message) {
                            console.log("\u2705 API: Received message from price feed topic: ".concat(message.type));
                            message_store_1.default.addMessage(priceFeedTopicId, message);
                        })];
                case 4:
                    // Subscribe to price feed topic
                    _a.sent();
                    initializedTopics = true;
                    console.log('✅ API: Successfully subscribed to all HCS topics');
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error('❌ API: Error initializing topic subscriptions:', error_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function GET() {
    return __awaiter(this, void 0, void 0, function () {
        var governanceTopicId, agentTopicId, priceFeedTopicId, allMessages, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // During build, just return empty array
                    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
                        return [2 /*return*/, server_1.NextResponse.json([])];
                    }
                    governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
                    agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
                    priceFeedTopicId = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;
                    console.log('🔍 API GET: Fetching HCS messages with topic IDs:', {
                        governanceTopic: governanceTopicId,
                        agentTopic: agentTopicId,
                        priceFeedTopic: priceFeedTopicId
                    });
                    if (!governanceTopicId || !agentTopicId || !priceFeedTopicId) {
                        console.error('❌ API GET ERROR: HCS topic IDs not configured');
                        throw new Error('HCS topic IDs not configured');
                    }
                    // Initialize subscriptions in a more controlled way
                    return [4 /*yield*/, initializeSubscriptions()];
                case 1:
                    // Initialize subscriptions in a more controlled way
                    _a.sent();
                    allMessages = message_store_1.default.getAllMessages();
                    // Log summary of messages
                    console.log("\uD83D\uDCE4 API GET: Returning ".concat(allMessages.length, " messages from global store"));
                    return [2 /*return*/, server_1.NextResponse.json(allMessages)];
                case 2:
                    error_2 = _a.sent();
                    console.error('❌ API GET ERROR: Error fetching HCS messages:', error_2);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var body, action, proposalId, newWeights, executeAfter, quorum, trigger, justification, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, request.json()];
                case 1:
                    body = _a.sent();
                    action = body.action, proposalId = body.proposalId, newWeights = body.newWeights, executeAfter = body.executeAfter, quorum = body.quorum, trigger = body.trigger, justification = body.justification;
                    console.log('📩 API: Received HCS message request:', {
                        action: action,
                        proposalId: proposalId,
                        newWeightsTokens: newWeights ? Object.keys(newWeights) : [],
                        executeAfter: executeAfter ? new Date(executeAfter).toISOString() : null,
                        quorum: quorum,
                        trigger: trigger,
                        justificationLength: justification === null || justification === void 0 ? void 0 : justification.length
                    });
                    if (!(action === 'propose')) return [3 /*break*/, 3];
                    if (!newWeights || !executeAfter || !quorum) {
                        console.error('⚠️ API: Missing required fields for proposal');
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Missing required fields for proposal' }, { status: 400 })];
                    }
                    console.log('🔄 API: Calling proposeRebalance in HederaService...');
                    return [4 /*yield*/, hedera_1.hederaService.proposeRebalance(newWeights, executeAfter, quorum, trigger, justification)];
                case 2:
                    _a.sent();
                    console.log('✅ API: Successfully proposed rebalance!');
                    return [3 /*break*/, 8];
                case 3:
                    if (!(action === 'execute')) return [3 /*break*/, 5];
                    if (!proposalId || !newWeights) {
                        console.error('⚠️ API: Missing required fields for execution');
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Missing required fields for execution' }, { status: 400 })];
                    }
                    console.log('🔄 API: Calling executeRebalance in HederaService...');
                    return [4 /*yield*/, hedera_1.hederaService.executeRebalance(proposalId, newWeights)];
                case 4:
                    _a.sent();
                    console.log('✅ API: Successfully executed rebalance!');
                    return [3 /*break*/, 8];
                case 5:
                    if (!(action === 'approve')) return [3 /*break*/, 7];
                    if (!proposalId) {
                        console.error('⚠️ API: Proposal ID is required');
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 })];
                    }
                    console.log('🔄 API: Calling approveRebalance in HederaService...');
                    return [4 /*yield*/, hedera_1.hederaService.approveRebalance(proposalId)];
                case 6:
                    _a.sent();
                    console.log('✅ API: Successfully approved rebalance!');
                    return [3 /*break*/, 8];
                case 7:
                    console.error('⚠️ API: Invalid action requested:', action);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Invalid action' }, { status: 400 })];
                case 8:
                    console.log('📤 API: Returning success response');
                    return [2 /*return*/, server_1.NextResponse.json({ success: true })];
                case 9:
                    error_3 = _a.sent();
                    console.error('❌ API ERROR: Error processing proposal:', error_3);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 })];
                case 10: return [2 /*return*/];
            }
        });
    });
}
