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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
var server_1 = require("next/server");
var hedera_1 = require("@/app/services/hedera");
// Only run on server, not during build
exports.dynamic = 'force-dynamic';
exports.runtime = 'nodejs';
var hederaService = new hedera_1.HederaService();
function GET() {
    return __awaiter(this, void 0, void 0, function () {
        var mockData;
        return __generator(this, function (_a) {
            try {
                mockData = [
                    {
                        id: 'P123',
                        type: 'RebalanceProposal',
                        timestamp: Date.now() - 3600000,
                        sender: '0.0.123',
                        status: 'pending',
                        details: {
                            newWeights: {
                                '0.0.123': 0.5,
                                '0.0.124': 0.3,
                                '0.0.125': 0.2
                            }
                        },
                        votes: {
                            for: 1500,
                            against: 500,
                            total: 2000
                        }
                    },
                    {
                        id: 'P124',
                        type: 'PolicyChange',
                        timestamp: Date.now() - 7200000,
                        sender: '0.0.124',
                        status: 'approved',
                        details: {
                            policyChanges: {
                                maxWeight: 0.5,
                                minLiquidity: 1000000
                            }
                        },
                        votes: {
                            for: 1800,
                            against: 200,
                            total: 2000
                        }
                    }
                ];
                return [2 /*return*/, server_1.NextResponse.json(mockData)];
            }
            catch (error) {
                console.error('Error fetching proposals:', error);
                return [2 /*return*/, server_1.NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 })];
            }
            return [2 /*return*/];
        });
    });
}
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var proposal, hcsMessage, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, request.json()];
                case 1:
                    proposal = _a.sent();
                    if (!process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC) {
                        throw new Error('Missing NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC environment variable');
                    }
                    hcsMessage = __assign({ id: "proposal-".concat(Date.now()), type: 'RebalanceProposal', timestamp: Date.now(), sender: 'ui-user' }, proposal);
                    console.log("\uD83D\uDCE8 Submitting proposal to HCS: ".concat(JSON.stringify(hcsMessage)));
                    // Use the correct method to publish the message to HCS
                    return [4 /*yield*/, hederaService.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC, hcsMessage)];
                case 2:
                    // Use the correct method to publish the message to HCS
                    _a.sent();
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            message: "Proposal successfully submitted to HCS",
                            proposalId: hcsMessage.id
                        })];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error publishing proposal:', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: 'Failed to publish proposal to HCS',
                            message: error_1 instanceof Error ? error_1.message : 'Internal server error'
                        }, { status: 500 })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
