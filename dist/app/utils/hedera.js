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
exports.getTokenMetadata = getTokenMetadata;
exports.getTokenImageUrl = getTokenImageUrl;
exports.getTransactionsByTokenId = getTransactionsByTokenId;
exports.getTokenBalancesByAccountId = getTokenBalancesByAccountId;
exports.getTokenStats = getTokenStats;
exports.getTokenLiquidity = getTokenLiquidity;
exports.calculateTokenRatio = calculateTokenRatio;
var MIRROR_NODE_URL = 'https://mainnet.mirrornode.hedera.com';
var SAUCERSWAP_API = 'https://api.saucerswap.finance/api/v1';
function formatTokenIdForMirrorNode(tokenId) {
    // Remove dots and convert to raw format (e.g., '0.0.123' becomes '123')
    return tokenId.split('.').pop() || tokenId;
}
function getTokenMetadata(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(MIRROR_NODE_URL, "/api/v1/tokens/").concat(tokenId), {
                            headers: {
                                'Accept': 'application/json'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch token metadata: ".concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, {
                            tokenId: data.token_id,
                            symbol: data.symbol,
                            name: data.name,
                            decimals: data.decimals,
                            totalSupply: data.total_supply,
                            maxSupply: data.max_supply,
                            treasury: data.treasury_account_id,
                            supplyType: data.supply_type,
                            type: data.type,
                            customFees: data.custom_fees,
                            icon: null
                        }];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error fetching metadata for token ".concat(tokenId, ":"), error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getTokenImageUrl(tokenId) {
    // Note: Mirror Node doesn't provide token logos directly
    // This is a placeholder that should be removed or replaced with an alternative source
    return null;
}
function getTransactionsByTokenId(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        var formattedTokenId, response, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    formattedTokenId = formatTokenIdForMirrorNode(tokenId);
                    return [4 /*yield*/, fetch("".concat(MIRROR_NODE_URL, "/api/v1/tokens/").concat(formattedTokenId, "/transactions"), {
                            headers: {
                                'Accept': 'application/json',
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch token transactions: ".concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, data.transactions];
                case 3:
                    error_2 = _a.sent();
                    console.error("Error fetching transactions for token ".concat(tokenId, ":"), error_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getTokenBalancesByAccountId(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var formattedAccountId, response, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    formattedAccountId = formatTokenIdForMirrorNode(accountId);
                    return [4 /*yield*/, fetch("".concat(MIRROR_NODE_URL, "/api/v1/accounts/").concat(formattedAccountId, "/tokens"), {
                            headers: {
                                'Accept': 'application/json',
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch account token balances: ".concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, data.tokens];
                case 3:
                    error_3 = _a.sent();
                    console.error("Error fetching token balances for account ".concat(accountId, ":"), error_3);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getSaucerSwapStats(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        var formattedTokenId_1, tokenResponse, tokensData, tokenData, poolsResponse, poolsData, relevantPools, tvlUSD, volume24h, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    formattedTokenId_1 = tokenId.startsWith('0.0.') ? tokenId : "0.0.".concat(tokenId);
                    return [4 /*yield*/, fetch("".concat(SAUCERSWAP_API, "/tokens"))];
                case 1:
                    tokenResponse = _a.sent();
                    if (!tokenResponse.ok) {
                        console.error('Failed to fetch token stats from SaucerSwap');
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, tokenResponse.json()];
                case 2:
                    tokensData = _a.sent();
                    tokenData = tokensData.find(function (token) { return token.id === formattedTokenId_1; });
                    if (!tokenData) {
                        console.error("Token ".concat(formattedTokenId_1, " not found in SaucerSwap"));
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, fetch("".concat(SAUCERSWAP_API, "/pools"))];
                case 3:
                    poolsResponse = _a.sent();
                    if (!poolsResponse.ok) {
                        console.error('Failed to fetch pools from SaucerSwap');
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, poolsResponse.json()];
                case 4:
                    poolsData = _a.sent();
                    relevantPools = poolsData.filter(function (pool) {
                        return pool.token0.id === formattedTokenId_1 || pool.token1.id === formattedTokenId_1;
                    });
                    tvlUSD = relevantPools.reduce(function (sum, pool) {
                        return sum + Number(pool.tvl || 0);
                    }, 0);
                    volume24h = relevantPools.reduce(function (sum, pool) {
                        return sum + Number(pool.volume24H || 0);
                    }, 0);
                    return [2 /*return*/, {
                            tvlUSD: tvlUSD,
                            volume24h: volume24h,
                            priceUSD: Number(tokenData.price || 0),
                        }];
                case 5:
                    error_4 = _a.sent();
                    console.error('Error fetching SaucerSwap stats:', error_4);
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getTokenStats(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        var saucerStats, tvlUSD, volume24h, priceUSD, formattedTokenId, response, tokenData, totalSupply, marketCap, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, getSaucerSwapStats(tokenId)];
                case 1:
                    saucerStats = _a.sent();
                    if (!saucerStats)
                        return [2 /*return*/, null];
                    tvlUSD = saucerStats.tvlUSD, volume24h = saucerStats.volume24h, priceUSD = saucerStats.priceUSD;
                    formattedTokenId = formatTokenIdForMirrorNode(tokenId);
                    return [4 /*yield*/, fetch("".concat(MIRROR_NODE_URL, "/api/v1/tokens/").concat(formattedTokenId), {
                            headers: {
                                'Accept': 'application/json',
                            }
                        })];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    tokenData = _a.sent();
                    totalSupply = Number(tokenData.total_supply) / Math.pow(10, tokenData.decimals);
                    marketCap = totalSupply * priceUSD;
                    return [2 /*return*/, {
                            marketCap: marketCap,
                            liquidity: tvlUSD,
                            volume24h: volume24h,
                        }];
                case 4:
                    error_5 = _a.sent();
                    console.error("Error fetching token stats for ".concat(tokenId, ":"), error_5);
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getTokenLiquidity(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        var saucerStats, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getSaucerSwapStats(tokenId)];
                case 1:
                    saucerStats = _a.sent();
                    if (!saucerStats)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            tokenId: tokenId,
                            volume24h: saucerStats.volume24h,
                            liquidityDepth: saucerStats.tvlUSD,
                            lastUpdated: new Date()
                        }];
                case 2:
                    error_6 = _a.sent();
                    console.error("Error fetching token liquidity for ".concat(tokenId, ":"), error_6);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function calculateTokenRatio(marketCap, liquidityData, totalMarketCap, minLiquidityThreshold) {
    // If liquidity is below threshold, reduce the weight
    var liquidityRatio = liquidityData.liquidityDepth / marketCap;
    var liquidityMultiplier = liquidityRatio < minLiquidityThreshold ? 0.5 : 1;
    // Base weight from market cap
    var baseWeight = (marketCap / totalMarketCap) * 100;
    // Adjusted weight considering liquidity
    return baseWeight * liquidityMultiplier;
}
