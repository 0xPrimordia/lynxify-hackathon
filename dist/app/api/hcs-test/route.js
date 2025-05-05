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
var server_1 = require("next/server");
var hedera_1 = require("@/app/services/hedera");
var message_store_1 = __importDefault(require("@/app/services/message-store"));
// Only run on server, not during build
exports.dynamic = 'force-dynamic';
exports.runtime = 'nodejs';
function GET() {
    return __awaiter(this, void 0, void 0, function () {
        var governanceTopicId, agentTopicId, testMessage_1, error_1, governanceMessages, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    console.log('🔍 HCS TEST: Starting HCS test...');
                    governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
                    agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
                    if (!governanceTopicId || !agentTopicId) {
                        console.error('❌ HCS TEST ERROR: HCS topic IDs not configured');
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'HCS topic IDs not configured' }, { status: 500 })];
                    }
                    console.log('🔄 HCS TEST: Publishing test message to governance topic...');
                    testMessage_1 = {
                        id: "test-".concat(Date.now()),
                        type: 'RebalanceProposal',
                        timestamp: Date.now(),
                        sender: 'hcs-test',
                        details: {
                            message: 'This is a test message from the HCS test endpoint',
                            newWeights: {
                                "HBAR": 0.25,
                                "WBTC": 0.25,
                                "WETH": 0.25,
                                "USDC": 0.25
                            },
                            executeAfter: Date.now() + 1000 * 60 * 60, // 1 hour from now
                            quorum: 5000
                        }
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, hedera_1.hederaService.publishHCSMessage(governanceTopicId, testMessage_1)];
                case 2:
                    _a.sent();
                    console.log('✅ HCS TEST: Test message published successfully');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('❌ HCS TEST ERROR: Failed to publish test message', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({
                            error: 'Failed to publish test message',
                            details: error_1 instanceof Error ? error_1.message : String(error_1)
                        }, { status: 500 })];
                case 4:
                    // Wait a moment for the message to propagate
                    console.log('⏱️ HCS TEST: Waiting for message to propagate...');
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 5:
                    _a.sent();
                    // Try to read messages from the governance topic
                    console.log('🔄 HCS TEST: Fetching messages from governance topic...');
                    governanceMessages = void 0;
                    try {
                        governanceMessages = message_store_1.default.getMessages(governanceTopicId);
                        console.log("\u2705 HCS TEST: Received ".concat(governanceMessages.length, " messages from governance topic"));
                    }
                    catch (error) {
                        console.error('❌ HCS TEST ERROR: Failed to fetch messages from governance topic', error);
                        return [2 /*return*/, server_1.NextResponse.json({
                                error: 'Failed to fetch messages from governance topic',
                                details: error instanceof Error ? error.message : String(error)
                            }, { status: 500 })];
                    }
                    // Return the test result
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            testMessageId: testMessage_1.id,
                            governanceMessages: governanceMessages.map(function (msg) { return ({
                                id: msg.id,
                                type: msg.type,
                                timestamp: new Date(msg.timestamp).toISOString(),
                                sender: msg.sender
                            }); }),
                            governanceMessagesCount: governanceMessages.length,
                            testMessageFound: governanceMessages.some(function (msg) { return msg.id === testMessage_1.id; })
                        })];
                case 6:
                    error_2 = _a.sent();
                    console.error('❌ HCS TEST ERROR: Unexpected error', error_2);
                    return [2 /*return*/, server_1.NextResponse.json({
                            error: 'Unexpected error',
                            details: error_2 instanceof Error ? error_2.message : String(error_2)
                        }, { status: 500 })];
                case 7: return [2 /*return*/];
            }
        });
    });
}
