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
exports.HCS10MessageSchema = void 0;
exports.getMockPrices = getMockPrices;
exports.createTopic = createTopic;
exports.publishMessage = publishMessage;
exports.listenToMessages = listenToMessages;
exports.mockAgentAction = mockAgentAction;
exports.getTokenizedIndex = getTokenizedIndex;
exports.updateTokenComposition = updateTokenComposition;
exports.GET = GET;
exports.POST = POST;
exports.publishGovernanceSettings = publishGovernanceSettings;
var sdk_1 = require("@hashgraph/sdk");
var server_1 = require("next/server");
function getClient() {
    var operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    var operatorPrivateKey = process.env.OPERATOR_KEY;
    if (operatorId == null || operatorPrivateKey == null) {
        throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be present");
    }
    var client = sdk_1.Client.forTestnet();
    client.setOperator(operatorId, sdk_1.PrivateKey.fromString(operatorPrivateKey));
    return client;
}
var proposals = [
    { id: 1, title: 'Proposal 1', votes: 0 },
    { id: 2, title: 'Proposal 2', votes: 0 },
];
var topicId = "";
var mockPrices = {
    BTC: 30000,
    ETH: 2000,
    HBAR: 0.1,
};
function getMockPrices() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, server_1.NextResponse.json(mockPrices)];
        });
    });
}
function createTopic() {
    return __awaiter(this, void 0, void 0, function () {
        var client, transaction, response, receipt;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getClient();
                    transaction = new sdk_1.TopicCreateTransaction();
                    return [4 /*yield*/, transaction.execute(client)];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, response.getReceipt(client)];
                case 2:
                    receipt = _b.sent();
                    topicId = ((_a = receipt.topicId) === null || _a === void 0 ? void 0 : _a.toString()) || "";
                    console.log("New topic created with ID:", topicId);
                    return [2 /*return*/];
            }
        });
    });
}
function publishMessage(topicId, message) {
    return __awaiter(this, void 0, void 0, function () {
        var client, transaction, response, receipt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getClient();
                    transaction = new sdk_1.TopicMessageSubmitTransaction()
                        .setTopicId(sdk_1.TopicId.fromString(topicId))
                        .setMessage(JSON.stringify(message));
                    return [4 /*yield*/, transaction.execute(client)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.getReceipt(client)];
                case 2:
                    receipt = _a.sent();
                    console.log("Message published successfully");
                    return [2 /*return*/, receipt];
            }
        });
    });
}
function listenToMessages(topicId, callback) {
    return __awaiter(this, void 0, void 0, function () {
        var client, query;
        return __generator(this, function (_a) {
            client = getClient();
            query = new sdk_1.TopicMessageQuery()
                .setTopicId(sdk_1.TopicId.fromString(topicId));
            query.subscribe(client, function (error) {
                console.error("Error in subscription:", error);
            }, function (message) {
                try {
                    var parsedMessage = JSON.parse(message.contents.toString());
                    callback(parsedMessage);
                }
                catch (error) {
                    console.error("Error parsing message:", error);
                }
            });
            return [2 /*return*/];
        });
    });
}
function mockAgentAction(action, params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("Mock agent action:", action, params);
            return [2 /*return*/, { success: true }];
        });
    });
}
var tokenizedIndex = {
    totalSupply: 1000000,
    composition: [
        { asset: 'Asset A', weight: 50 },
        { asset: 'Asset B', weight: 30 },
        { asset: 'Asset C', weight: 20 },
    ],
};
function getTokenizedIndex() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, server_1.NextResponse.json(tokenizedIndex)];
        });
    });
}
function updateTokenComposition(newWeights) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("Updating token composition with weights:", newWeights);
            return [2 /*return*/, { success: true }];
        });
    });
}
function GET() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, server_1.NextResponse.json(proposals)];
        });
    });
}
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, type, data, newProposal, proposal;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, request.json()];
                case 1:
                    _a = _b.sent(), type = _a.type, data = _a.data;
                    if (type === 'proposal') {
                        newProposal = { id: proposals.length + 1, title: data, votes: 0 };
                        proposals.push(newProposal);
                        return [2 /*return*/, server_1.NextResponse.json({ message: 'Proposal added', proposals: proposals })];
                    }
                    if (type === 'vote') {
                        proposal = proposals.find(function (p) { return p.id === data.id; });
                        if (proposal) {
                            proposal.votes += 1;
                            return [2 /*return*/, server_1.NextResponse.json({ message: 'Vote cast', proposals: proposals })];
                        }
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Proposal not found' }, { status: 404 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Invalid request' }, { status: 400 })];
            }
        });
    });
}
exports.HCS10MessageSchema = {
    type: "object",
    properties: {
        messageType: { type: "string" },
        commandDetails: { type: "object" },
        agentIdentifier: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
        context: { type: "string" },
    },
    required: ["messageType", "commandDetails", "agentIdentifier", "timestamp"],
};
function publishGovernanceSettings(topicId, message) {
    return __awaiter(this, void 0, void 0, function () {
        var client, transaction, response, receipt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getClient();
                    transaction = new sdk_1.TopicMessageSubmitTransaction()
                        .setTopicId(sdk_1.TopicId.fromString(topicId))
                        .setMessage(JSON.stringify(message));
                    return [4 /*yield*/, transaction.execute(client)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.getReceipt(client)];
                case 2:
                    receipt = _a.sent();
                    console.log("Governance settings published successfully");
                    return [2 /*return*/, receipt];
            }
        });
    });
}
