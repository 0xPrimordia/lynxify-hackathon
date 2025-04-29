"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = __importDefault(require("openai"));
class AIService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not found in environment variables');
        }
        this.openai = new openai_1.default({ apiKey });
    }
    async analyzeMarketAndDecideRebalance(currentWeights, marketData) {
        try {
            const prompt = this.buildAnalysisPrompt(currentWeights, marketData);
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert crypto market analyst and portfolio manager. Your task is to analyze market data and suggest optimal token weights for a balanced portfolio. Consider factors like liquidity, volume, and market trends. Provide clear reasoning for each decision."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });
            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI');
            }
            return this.parseAIResponse(response);
        }
        catch (error) {
            console.error('Error in AI analysis:', error);
            throw error;
        }
    }
    buildAnalysisPrompt(currentWeights, marketData) {
        return `
Current Portfolio Weights:
${Object.entries(currentWeights).map(([token, weight]) => `${token}: ${weight}%`).join('\n')}

Market Data:
${marketData.map(data => `
Token: ${data.token}
Price: $${data.price}
24h Volume: $${data.volume24h}
Liquidity Depth: $${data.liquidityDepth}
Last Updated: ${new Date(data.lastUpdated).toISOString()}
`).join('\n')}

Please analyze this data and suggest optimal token weights for a balanced portfolio. Consider:
1. Liquidity and trading volume
2. Market trends and price stability
3. Risk management and diversification
4. Current market conditions

Format your response as a JSON array of objects with the following structure:
[
  {
    "token": "TOKEN_SYMBOL",
    "targetWeight": NUMBER,
    "reason": "EXPLANATION"
  }
]
`;
    }
    parseAIResponse(response) {
        try {
            // Extract JSON from the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            const decisions = JSON.parse(jsonMatch[0]);
            // Validate the response format
            if (!Array.isArray(decisions)) {
                throw new Error('AI response is not an array');
            }
            decisions.forEach(decision => {
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
    }
}
exports.AIService = AIService;
