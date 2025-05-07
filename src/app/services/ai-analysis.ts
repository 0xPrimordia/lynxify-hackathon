import { HCSMessage } from '../types/hcs';
import { TokenWeights } from '../types/hcs';
import OpenAI from 'openai';

/**
 * AI Analysis Service
 * Uses OpenAI to analyze rebalance proposals and generate insights
 */
export class AIAnalysisService {
  private openai: OpenAI;
  
  /**
   * Initialize the AI Analysis Service
   * @param apiKey OpenAI API key
   */
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  /**
   * Analyze a rebalance proposal using OpenAI
   * @param proposal The rebalance proposal message
   * @returns Analysis of the proposal as a string
   */
  async analyzeRebalanceProposal(proposal: HCSMessage): Promise<string> {
    try {
      console.log('🧠 AI ANALYSIS: Analyzing proposal with OpenAI...');
      
      const newWeights = proposal.details?.newWeights as TokenWeights || {};
      const tokens = Object.keys(newWeights);
      const weights = Object.values(newWeights);
      
      if (tokens.length === 0) {
        return "No token weights found in the proposal. Unable to analyze.";
      }
      
      const prompt = `
      As an AI asset rebalancing agent, I'm executing a rebalance of a tokenized index with the following new weights:
      ${tokens.map((token, i) => `${token}: ${weights[i] * 100}%`).join('\n')}
      
      Please provide a brief analysis (2-3 sentences) of this rebalance, focusing on:
      1. Any notable shifts in allocation (increases/decreases)
      2. The potential strategy behind this rebalance
      3. Potential market conditions that might justify this rebalance
      `;
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an AI agent for tokenized index rebalancing that provides concise, professional analysis." },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
      });
      
      const analysis = response.choices[0]?.message?.content || 
        "Analysis could not be generated. Proceeding with rebalance based on approved proposal parameters.";
      
      console.log('🧠 AI ANALYSIS: Analysis complete');
      return analysis;
    } catch (error) {
      console.error('❌ AI ANALYSIS ERROR: Failed to analyze with OpenAI:', error);
      return "AI analysis unavailable. Proceeding with rebalance based on approved proposal parameters.";
    }
  }
  
  /**
   * Generate a summary of a rebalance execution
   * @param preBalances Previous token balances
   * @param postBalances New token balances after rebalance
   * @returns Summary of the rebalance execution
   */
  async generateRebalanceSummary(
    preBalances: Record<string, number | string>,
    postBalances: Record<string, number | string>
  ): Promise<string> {
    try {
      console.log('🧠 AI ANALYSIS: Generating rebalance summary...');
      
      // Format balances for the prompt
      const tokenNames = Object.keys({ ...preBalances, ...postBalances });
      const balanceChanges = tokenNames.map(token => {
        const pre = Number(preBalances[token] || 0);
        const post = Number(postBalances[token] || 0);
        const diff = post - pre;
        const percent = pre > 0 ? (diff / pre) * 100 : 0;
        
        return `${token}: ${pre} → ${post} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}, ${percent.toFixed(2)}%)`;
      }).join('\n');
      
      const prompt = `
      Summarize the following tokenized index rebalance operation in a single clear, concise paragraph:
      
      ${balanceChanges}
      `;
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an AI agent for tokenized index rebalancing that provides concise, professional summaries." },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
      });
      
      const summary = response.choices[0]?.message?.content || 
        "Rebalance executed successfully, adjusting token allocations according to the approved proposal.";
      
      console.log('🧠 AI ANALYSIS: Summary generated');
      return summary;
    } catch (error) {
      console.error('❌ AI ANALYSIS ERROR: Failed to generate summary:', error);
      return "Rebalance executed successfully, adjusting token allocations according to the approved proposal.";
    }
  }
}

// Create a singleton instance if OpenAI API key is available
const apiKey = process.env.OPENAI_API_KEY;
const aiAnalysis = apiKey 
  ? new AIAnalysisService(apiKey) 
  : null;

export default aiAnalysis; 