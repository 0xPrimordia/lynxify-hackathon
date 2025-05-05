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
exports.AIService = void 0;
var openai_1 = __importDefault(require("openai"));
var AIService = /** @class */ (function () {
    function AIService() {
        var apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not found in environment variables');
        }
        this.openai = new openai_1.default({ apiKey: apiKey });
    }
    AIService.prototype.analyzeMarketAndDecideRebalance = function (currentWeights, marketData) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt_1, completion, response, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        prompt_1 = this.buildAnalysisPrompt(currentWeights, marketData);
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: "gpt-4-turbo-preview",
                                messages: [
                                    {
                                        role: "system",
                                        content: "You are an expert crypto market analyst and portfolio manager. Your task is to analyze market data and suggest optimal token weights for a balanced portfolio. Consider factors like liquidity, volume, and market trends. Provide clear reasoning for each decision."
                                    },
                                    {
                                        role: "user",
                                        content: prompt_1
                                    }
                                ],
                                temperature: 0.7,
                                max_tokens: 1000
                            })];
                    case 1:
                        completion = _c.sent();
                        response = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
                        if (!response) {
                            throw new Error('No response from OpenAI');
                        }
                        return [2 /*return*/, this.parseAIResponse(response)];
                    case 2:
                        error_1 = _c.sent();
                        console.error('Error in AI analysis:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    AIService.prototype.buildAnalysisPrompt = function (currentWeights, marketData) {
        return "\nCurrent Portfolio Weights:\n".concat(Object.entries(currentWeights).map(function (_a) {
            var token = _a[0], weight = _a[1];
            return "".concat(token, ": ").concat(weight, "%");
        }).join('\n'), "\n\nMarket Data:\n").concat(marketData.map(function (data) { return "\nToken: ".concat(data.token, "\nPrice: $").concat(data.price, "\n24h Volume: $").concat(data.volume24h, "\nLiquidity Depth: $").concat(data.liquidityDepth, "\nLast Updated: ").concat(new Date(data.lastUpdated).toISOString(), "\n"); }).join('\n'), "\n\nPlease analyze this data and suggest optimal token weights for a balanced portfolio. Consider:\n1. Liquidity and trading volume\n2. Market trends and price stability\n3. Risk management and diversification\n4. Current market conditions\n\nFormat your response as a JSON array of objects with the following structure:\n[\n  {\n    \"token\": \"TOKEN_SYMBOL\",\n    \"targetWeight\": NUMBER,\n    \"reason\": \"EXPLANATION\"\n  }\n]\n");
    };
    AIService.prototype.parseAIResponse = function (response) {
        try {
            // Extract JSON from the response
            var jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            var decisions = JSON.parse(jsonMatch[0]);
            // Validate the response format
            if (!Array.isArray(decisions)) {
                throw new Error('AI response is not an array');
            }
            decisions.forEach(function (decision) {
                if (!decision.token || typeof decision.targetWeight !== 'number' || !decision.reason) {
                    throw new Error('Invalid decision format in AI response');
                }
            });
            return decisions;
        }
        catch (error) {
            console.error('Error parsing AI response:', error);
            throw error;
        }
    };
    return AIService;
}());
exports.AIService = AIService;
