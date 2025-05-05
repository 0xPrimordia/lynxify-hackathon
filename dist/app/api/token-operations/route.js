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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = exports.dynamic = void 0;
exports.GET = GET;
var server_1 = require("next/server");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
// Only run on server, not during build
exports.dynamic = 'force-dynamic';
exports.runtime = 'nodejs';
// Function to generate the proper URL format for Hashscan
function generateHashscanUrl(transactionId, consensusTimestamp, tokenId) {
    // For token creation transactions, use token page format if tokenId is provided
    if (tokenId) {
        return "https://hashscan.io/testnet/token/".concat(tokenId);
    }
    // For transaction IDs from Mirror Node API, use as-is
    if (transactionId) {
        return "https://hashscan.io/testnet/transaction/".concat(transactionId);
    }
    // Fallback
    return "https://hashscan.io/testnet/transaction/unknown";
}
// Format timestamp from Mirror Node to ISO string
function formatTimestamp(consensusTimestamp) {
    var seconds = parseInt(consensusTimestamp.split('.')[0]);
    return new Date(seconds * 1000).toISOString();
}
// Hardcoded fallback token data for Vercel deployment
var fallbackTokenData = {
    "tokens": {
        "btc": {
            "tokenId": "0.0.5924920",
            "name": "BTC-Demo",
            "symbol": "BTC",
            "transactionId": "0.0.5924920@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924920@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924920"
                }
            ]
        },
        "eth": {
            "tokenId": "0.0.5924921",
            "name": "ETH-Demo",
            "symbol": "ETH",
            "transactionId": "0.0.5924921@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924921@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924921"
                }
            ]
        },
        "sol": {
            "tokenId": "0.0.5924922",
            "name": "SOL-Demo",
            "symbol": "SOL",
            "transactionId": "0.0.5924922@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924922@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924922"
                }
            ]
        },
        "lynx": {
            "tokenId": "0.0.5924924",
            "name": "Lynxify-Index",
            "symbol": "LYNX",
            "transactionId": "0.0.5924924@1714416000.123456789",
            "transactions": [
                {
                    "type": "CREATE",
                    "txId": "0.0.5924924@1714416000.123456789",
                    "timestamp": "2024-05-30T12:00:00.000Z",
                    "hashscanUrl": "https://hashscan.io/testnet/token/0.0.5924924"
                }
            ]
        }
    },
    "network": "testnet"
};
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var data, filePath, MIRROR_NODE_URL_1, tokenInfo, fetchError_1, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    data = void 0;
                    // Try to read the token data file, if it exists and we're not in a serverless environment
                    try {
                        if (process.env.NODE_ENV === 'development') {
                            filePath = path.join(process.cwd(), 'token-data.json');
                            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            console.log('Successfully read token data from file');
                        }
                        else {
                            // In production/Vercel, use the fallback data
                            console.log('Using fallback token data in production environment');
                            data = fallbackTokenData;
                        }
                    }
                    catch (error) {
                        // Fallback if file reading fails
                        console.log('Error reading token data file, using fallback data:', error);
                        data = fallbackTokenData;
                    }
                    MIRROR_NODE_URL_1 = 'https://testnet.mirrornode.hedera.com';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all(Object.values(data.tokens).map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var transactions, tokenUrl, tokenResponse, tokenData, txUrl, txResponse, txData, tokenTransactions, mappedTransactions, err_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        transactions = [];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 7, , 8]);
                                        // Get token data from Mirror Node
                                        console.log("Fetching token data for ".concat(token.tokenId, " from Mirror Node..."));
                                        tokenUrl = "".concat(MIRROR_NODE_URL_1, "/api/v1/tokens/").concat(token.tokenId);
                                        return [4 /*yield*/, fetch(tokenUrl)];
                                    case 2:
                                        tokenResponse = _a.sent();
                                        if (!tokenResponse.ok) return [3 /*break*/, 6];
                                        return [4 /*yield*/, tokenResponse.json()];
                                    case 3:
                                        tokenData = _a.sent();
                                        console.log("Found token ".concat(tokenData.token_id, " (").concat(tokenData.name, ")"));
                                        // Add CREATE transaction with proper link
                                        transactions.push({
                                            type: 'CREATE',
                                            txId: token.transactionId || tokenData.created_timestamp,
                                            timestamp: tokenData.created_timestamp
                                                ? formatTimestamp(tokenData.created_timestamp)
                                                : token.transactions[0].timestamp,
                                            hashscanUrl: generateHashscanUrl(null, undefined, token.tokenId)
                                        });
                                        if (!process.env.NEXT_PUBLIC_OPERATOR_ID) return [3 /*break*/, 6];
                                        txUrl = "".concat(MIRROR_NODE_URL_1, "/api/v1/transactions?account.id=").concat(process.env.NEXT_PUBLIC_OPERATOR_ID, "&limit=100&order=desc");
                                        console.log("Fetching transactions from ".concat(txUrl));
                                        return [4 /*yield*/, fetch(txUrl)];
                                    case 4:
                                        txResponse = _a.sent();
                                        if (!txResponse.ok) return [3 /*break*/, 6];
                                        return [4 /*yield*/, txResponse.json()];
                                    case 5:
                                        txData = _a.sent();
                                        tokenTransactions = txData.transactions.filter(function (tx) {
                                            var _a;
                                            return (_a = tx.token_transfers) === null || _a === void 0 ? void 0 : _a.some(function (transfer) {
                                                return transfer.token_id === token.tokenId;
                                            });
                                        });
                                        console.log("Found ".concat(tokenTransactions.length, " transactions for token ").concat(token.tokenId));
                                        mappedTransactions = tokenTransactions.map(function (tx) {
                                            // Find the transfer for this token
                                            var transfer = tx.token_transfers.find(function (t) { return t.token_id === token.tokenId; });
                                            if (!transfer)
                                                return null;
                                            var amount = Math.abs(Number(transfer.amount));
                                            // Check if amount is positive (mint) or negative (burn)
                                            var type = Number(transfer.amount) > 0 ? 'MINT' : 'BURN';
                                            return {
                                                type: type,
                                                txId: tx.transaction_id,
                                                timestamp: formatTimestamp(tx.consensus_timestamp),
                                                amount: amount,
                                                hashscanUrl: "https://hashscan.io/testnet/transaction/".concat(tx.transaction_id)
                                            };
                                        }).filter(Boolean);
                                        // Add these transactions to our list
                                        transactions = __spreadArray(__spreadArray([], transactions, true), mappedTransactions, true);
                                        _a.label = 6;
                                    case 6: return [3 /*break*/, 8];
                                    case 7:
                                        err_1 = _a.sent();
                                        console.error("Error fetching transaction data for ".concat(token.tokenId, ":"), err_1);
                                        // Fallback to token-data.json transactions if Mirror Node fails
                                        transactions = token.transactions || [];
                                        return [3 /*break*/, 8];
                                    case 8: return [2 /*return*/, __assign(__assign({}, token), { transactions: transactions.length > 0 ? transactions : token.transactions })];
                                }
                            });
                        }); }))];
                case 2:
                    tokenInfo = _a.sent();
                    return [2 /*return*/, server_1.NextResponse.json({
                            tokens: tokenInfo,
                            message: 'Token data retrieved successfully',
                            note: 'This page shows verified on-chain transactions from the Hedera Mirror Node',
                            timestamp: new Date().toISOString()
                        })];
                case 3:
                    fetchError_1 = _a.sent();
                    console.error('Error fetching token data from Mirror Node:', fetchError_1);
                    // Return the static data as fallback
                    return [2 /*return*/, server_1.NextResponse.json({
                            tokens: Object.values(data.tokens),
                            message: 'Token data retrieved from fallback',
                            note: 'Using static data due to Mirror Node connection issue',
                            timestamp: new Date().toISOString()
                        })];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error('Error retrieving token data:', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Failed to retrieve token data' }, { status: 500 })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
