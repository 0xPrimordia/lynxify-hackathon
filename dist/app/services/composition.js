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
exports.calculateOptimalComposition = calculateOptimalComposition;
exports.isRebalancingNeeded = isRebalancingNeeded;
var hedera_1 = require("../utils/hedera");
function calculateOptimalComposition(sectors_1) {
    return __awaiter(this, arguments, void 0, function (sectors, minLiquidityThreshold // 10% liquidity to market cap ratio as default
    ) {
        var composition, _loop_1, _i, sectors_2, sector;
        if (minLiquidityThreshold === void 0) { minLiquidityThreshold = 0.1; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    composition = [];
                    _loop_1 = function (sector) {
                        var weights, sectorMarketCap, _b, _c, token, liquidityData, mockMarketCap, _d, weights_1, weight, tokenWeight, totalCalculatedWeight, normalizer;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    weights = [];
                                    sectorMarketCap = 0;
                                    _b = 0, _c = sector.tokens;
                                    _e.label = 1;
                                case 1:
                                    if (!(_b < _c.length)) return [3 /*break*/, 4];
                                    token = _c[_b];
                                    if (!token.tokenId)
                                        return [3 /*break*/, 3];
                                    return [4 /*yield*/, (0, hedera_1.getTokenLiquidity)(token.tokenId)];
                                case 2:
                                    liquidityData = _e.sent();
                                    if (!liquidityData)
                                        return [3 /*break*/, 3];
                                    mockMarketCap = liquidityData.liquidityDepth * 3;
                                    sectorMarketCap += mockMarketCap;
                                    weights.push({
                                        token: token,
                                        weight: 0, // Will be calculated in second pass
                                        liquidityScore: liquidityData.liquidityDepth / mockMarketCap
                                    });
                                    _e.label = 3;
                                case 3:
                                    _b++;
                                    return [3 /*break*/, 1];
                                case 4:
                                    // Second pass: calculate actual weights considering liquidity
                                    for (_d = 0, weights_1 = weights; _d < weights_1.length; _d++) {
                                        weight = weights_1[_d];
                                        tokenWeight = (0, hedera_1.calculateTokenRatio)(sectorMarketCap / weights.length, // Simplified market cap distribution
                                        {
                                            tokenId: weight.token.tokenId,
                                            volume24h: 0, // Not used in this calculation
                                            liquidityDepth: weight.liquidityScore * sectorMarketCap,
                                            lastUpdated: new Date()
                                        }, sectorMarketCap, minLiquidityThreshold);
                                        weight.weight = tokenWeight;
                                    }
                                    totalCalculatedWeight = weights.reduce(function (sum, w) { return sum + w.weight; }, 0);
                                    normalizer = sector.weight / totalCalculatedWeight;
                                    weights.forEach(function (w) {
                                        w.weight *= normalizer;
                                    });
                                    composition.push({
                                        sector: sector.name,
                                        weights: weights,
                                        totalWeight: sector.weight
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, sectors_2 = sectors;
                    _a.label = 1;
                case 1:
                    if (!(_i < sectors_2.length)) return [3 /*break*/, 4];
                    sector = sectors_2[_i];
                    return [5 /*yield**/, _loop_1(sector)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, composition];
            }
        });
    });
}
// Function to check if rebalancing is needed based on weight drift
function isRebalancingNeeded(currentWeights, targetWeights, driftThreshold // 5% drift threshold by default
) {
    if (driftThreshold === void 0) { driftThreshold = 5; }
    var _loop_2 = function (current) {
        var target = targetWeights.find(function (t) { return t.token.tokenId === current.token.tokenId; });
        if (!target)
            return "continue";
        var drift = Math.abs(current.weight - target.weight);
        if (drift > driftThreshold) {
            return { value: true };
        }
    };
    for (var _i = 0, currentWeights_1 = currentWeights; _i < currentWeights_1.length; _i++) {
        var current = currentWeights_1[_i];
        var state_1 = _loop_2(current);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return false;
}
